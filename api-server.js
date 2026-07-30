// ====== Latte 情绪歌单 API 服务器 ======
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { buildCardBreakdown, buildSpreadSynthesis } = require('./lib/tarot-reading-format');
const { analyzeTurn, buildFallbackMessages } = require('./lib/tarot-chat-session');
const { decideIntake } = require('./lib/tarot-intake');

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  lines.forEach(line => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) return;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  });
}

loadEnvFile();
let netease = {};
try {
  netease = require('NeteaseCloudMusicApi');
} catch (e) {
  console.warn('[FM] NeteaseCloudMusicApi unavailable, using fallback library:', e.message);
}

const PORT = process.env.PORT || 8760;
const UID = Number(process.env.NETEASE_UID || 547894281);
const LIKED_PLAYLIST_ID = String(process.env.NETEASE_LIKED_PLAYLIST_ID || '820810253');
const ADMIN_TOKEN = process.env.FM_ADMIN_TOKEN || '';
const AI_API_KEY = process.env.TAROT_OFFLINE === '1' ? '' : (process.env.OPENAI_API_KEY || '');
const AI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const CACHE_TTL = 30 * 60 * 1000;
const DB_PATH = process.env.FM_STORE_PATH || path.join(__dirname, 'data', 'fm-store.json');
const TAROT_PERSONALITY_PATH = path.join(__dirname, 'data', 'latte-personality-layer.json');
const TAROT_CONVERSATION_GUIDE_PATH = path.join(__dirname, 'data', 'tarot-conversation-guide.json');

function loadTarotPersonality() {
  try {
    return JSON.parse(fs.readFileSync(TAROT_PERSONALITY_PATH, 'utf8'));
  } catch (e) {
    console.warn('[Tarot] personality config unavailable:', e.message);
    return { voice: { core: [], connectors: [], avoid: [] }, tarot: { required: [], qualityGate: [] } };
  }
}

const TAROT_PERSONALITY = loadTarotPersonality();

function loadTarotConversationGuide() {
  try {
    return JSON.parse(fs.readFileSync(TAROT_CONVERSATION_GUIDE_PATH, 'utf8'));
  } catch (e) {
    console.warn('[Tarot] conversation guide unavailable:', e.message);
    return { topics: {}, emotions: {}, needs: {}, risk: [] };
  }
}

const TAROT_CONVERSATION_GUIDE = loadTarotConversationGuide();

function matchedLabels(text, groups) {
  return Object.keys(groups || {}).filter(label => (groups[label] || []).some(word => text.includes(word)));
}

function analyzeTarotQuestion(question) {
  const text = question || '';
  return {
    topics: matchedLabels(text, TAROT_CONVERSATION_GUIDE.topics).slice(0, 3),
    emotions: matchedLabels(text, TAROT_CONVERSATION_GUIDE.emotions).slice(0, 3),
    needs: matchedLabels(text, TAROT_CONVERSATION_GUIDE.needs).slice(0, 3),
    causes: matchedLabels(text, TAROT_CONVERSATION_GUIDE.causes).slice(0, 3),
    intent: matchedLabels(text, TAROT_CONVERSATION_GUIDE.intent).slice(0, 2),
    risk: (TAROT_CONVERSATION_GUIDE.risk || []).some(word => text.includes(word))
  };
}

function tarotSystemPrompt() {
  const voice = TAROT_PERSONALITY.voice || {};
  const tarot = TAROT_PERSONALITY.tarot || {};
  return [
    '你是个人网站里的 LATTE 在线塔罗伙伴。你不是客服，也不是传统占卜师。',
    '回答必须是中文。塔罗只用于自我探索：不预测命运，不替用户拍板。',
    '人格基调：' + (voice.core || []).join(' '),
    '允许尖锐、刻薄一点的幽默，吐槽对象只能是荒谬处境、烂规则和现实的离谱安排，绝不能贬低访客。不要默认安慰；先把牌面事实和问题里的别扭处说清。',
    '自然连接词可以少量使用：' + (voice.connectors || []).join('、') + '。不要为了模仿而堆叠口头禅。',
    '必须做到：' + (tarot.required || []).join(' '),
    '质量检查：' + (tarot.qualityGate || []).join(' '),
    '禁用表达：' + (voice.avoid || []).join('；') + '。',
    '不要使用固定四段标题，也不要机械复用“我先看到的是”“说人话就是”这类句式。',
    '首轮 reply 先讲牌位、正逆位与牌义，再把牌义扔回用户的具体处境；多牌阵再讲牌与牌之间的逻辑。不要让“情绪安慰”挤掉牌面解释。每一段只推进一个判断，允许用一句辛辣的生活化吐槽收束。',
    '必须回应 userSignals 中至少一个话题、情绪、需求、触发成因或本次期待；不要只解释牌义。',
    '优先回应 cause：用户为什么会卡在这里，而不是泛泛说“我理解你的感受”。再回应 intent：用户这次更想被听见、理清楚，还是看看下一步。用户方向和牌面解析各占一半，不能用前者取代后者。',
    '不要把 signals 标签原样说给用户听，也不要假装知道用户没说过的事实。',
    '如果 userSignals.risk 为 true，停止占卜式解释，先明确建议用户立刻联系可信任的人、当地紧急服务或心理危机支持资源。',
    'plainSummary 用一句日常中文收束；reflectionQuestion 只留一个真正有用的问题。',
    '不要出现 seed、time_factor、AI Assistant、ChatGPT、机器人等字样。',
    '不要复述任何私人训练素材或聊天记录，只使用抽象人格规则。'
  ].join('\n');
}

function tarotQuestionKind(question, signals) {
  const topics = (signals && signals.topics) || [];
  const emotions = (signals && signals.emotions) || [];
  if (topics.includes('energy') || emotions.includes('exhausted')) return 'tired';
  if (topics.includes('relationship')) return 'relationship';
  if (topics.includes('choice') || topics.includes('work_study')) return 'choice';
  if (topics.includes('self_worth')) return 'self_worth';
  if (topics.includes('loss')) return 'loss';
  return 'general';
}

function tarotPick(lines, seed) {
  const score = Array.from(String(seed || '')).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return lines[score % lines.length];
}

const TAROT_SIGNAL_LABELS = {
  anxious: '不安', sad: '难过', angry: '生气', confused: '迷茫', lonely: '孤单', exhausted: '疲惫',
  validation: '被确认', clarity: '一个更清楚的说法', boundary: '边界感', permission: '一点允许', rest: '喘口气',
  inconsistent_contact: '反复等回应', being_overlooked: '被忽略的感觉', accumulated_load: '事情一直堆着', uncertain_outcome: '害怕承担未知后果', external_judgment: '被外部评价牵着走', unfinished_loss: '还没放下的遗憾',
  be_understood: '想确认自己是不是想多了', clarify: '想把事情理清楚', next_step: '想知道先从哪里下手', permission_to_pause: '想允许自己先停一下', boundary_check: '想确认这段关系的边界'
};

function tarotSignalNames(values) {
  return (values || []).map(value => TAROT_SIGNAL_LABELS[value] || value).join('、');
}

function tarotCauseLine(signals, seed) {
  const cause = (signals && signals.causes || [])[0];
  const lines = {
    inconsistent_contact: ['你提到反复等回应，这种累不是“消息没回”三个字这么简单，是人会被迫一直替对方补剧情，补久了当然烦。', '不是非得要求谁秒回，问题是你已经被放进了一个总要猜的状态里。这个状态本身就挺耗人的。'],
    being_overlooked: ['你卡住的地方可能不只是某件事没被回应，而是又一次感觉自己好像可以被顺手略过去。', '被忽略最烦的地方，是它很容易让人先回头质疑自己是不是要求太多。其实这两件事得分开看。'],
    accumulated_load: ['事情一件件堆着的时候，最先被压扁的往往不是效率，是人对“我还能不能处理”的判断。', '没有哪件事大到天塌，但它们很会搞团建。一直叠着，人当然会觉得自己快没电。'],
    uncertain_outcome: ['你怕的也许不只是选错，是选完以后要独自承担“早知道”的那一下。这个担心很具体，不是优柔寡断。', '不确定最会把人困住，因为每条路都像有点道理，后果却不能先打开预览。'],
    external_judgment: ['这里面夹着的可能不只是你自己的想法，还有别人给你的那把尺子。尺子先别急着当事实。', '被评价久了，人很容易把外面的声音搬进心里，之后连自己做决定都像在答题。'],
    unfinished_loss: ['你舍不得的部分未必等于该回头，有时只是那段期待还没来得及好好收尾。', '有些遗憾之所以黏着，不是因为它多正确，是因为它当初确实占过很大的位置。']
  };
  return cause && lines[cause] ? tarotPick(lines[cause], seed + cause) : '';
}

function tarotIntentQuestion(signals, fallbackQuestion, seed) {
  const intent = (signals && signals.intent || [])[0];
  const questions = {
    be_understood: ['你现在更想确认的，是自己是不是想多了，还是这件事确实已经让你不舒服很久了？'],
    clarify: ['要不要先把已经发生的事，和你为了填空而猜出来的那部分分开放？'],
    next_step: ['如果只处理一件最能让你松一点的事，你觉得会是哪一件？'],
    permission_to_pause: ['假如今天不需要证明自己扛得住，你愿意先停掉哪一件？'],
    boundary_check: ['你想守住的，到底是这段关系，还是你在这段关系里原本应有的位置？']
  };
  return intent && questions[intent] ? tarotPick(questions[intent], seed + intent) : fallbackQuestion;
}

function responseGroundedInQuestion(reply, question, signals) {
  const groups = ['causes', 'intent', 'needs', 'emotions', 'topics'];
  const labels = groups.flatMap(group => (signals && signals[group]) || []);
  const cues = labels.flatMap(label => {
    const group = groups.find(name => Object.prototype.hasOwnProperty.call(TAROT_CONVERSATION_GUIDE[name] || {}, label));
    return group ? (TAROT_CONVERSATION_GUIDE[group][label] || []) : [];
  }).filter(cue => String(question).includes(cue));
  return cues.length === 0 || cues.some(cue => String(reply).includes(cue));
}

function tarotFallback(question, cards, spreadName, signals) {
  const kind = tarotQuestionKind(question, signals);
  const first = cards[0] || { position: '现在', name: '这张牌', orientation: '正位', keywords: [], meaning: '' };
  const last = cards[cards.length - 1] || first;
  const seed = question + cards.map(card => card.name + card.orientation).join('');
  const openings = {
    tired: ['你说累的时候，我会先怀疑不是事情单独有多难，是它们一个接一个地来，连喘口气都得排队。', '先别急着把这个状态叫成“不够努力”。听起来更像是电一直在漏。'],
    relationship: ['我先不急着替谁站队。你在意的可能不只是这件事，是这件事之后自己被放在了什么位置。', '关系一旦让人反复确认自己是不是想多了，事情多半已经不只是“性格不同”了。'],
    choice: ['我不太想直接替你看“以后会不会更好”，先看你现在这个地方到底是在消耗，还是只是很难。', '选择这事最烦的地方，是两个选项都像有点道理，所以人才会卡住。'],
    self_worth: ['你问自己是不是不够好的时候，我会先把这个问题往回推一下：到底是谁让你开始用这种标准看自己？', '这件事里最麻烦的，可能不是你做得够不够好，是你已经很习惯先把错往自己身上收。'],
    loss: ['舍不得不一定说明该回头，有时候只是这段东西在你这里确实占过很大的位置。', '你现在难受的也许不只是失去一个人，是原来以为会有的那种以后突然没了。'],
    general: ['这个事乍一听有点乱，但乱也有乱的结构，先别急着给自己判。', '我先不替你把这团东西命名，名字起得太快，真正别扭的地方反而容易被盖过去。']
  };
  const questions = {
    tired: ['你现在最想停下来的，到底是哪一件事？', '如果不用证明自己很能扛，你会先放掉哪一部分？'],
    relationship: ['你最难受的，是对方做了什么，还是自己总在替这段关系找理由？', '你想要的是一个解释，还是一个能让你安心的行为？'],
    choice: ['你现在怕选错，还是怕选了以后要承担那个后果？', '两个选项里，哪一个更像你真心想要，只是你还没敢承认？'],
    self_worth: ['这件事里，哪一个评价其实是别人给你的，你却一直当成了自己的结论？', '如果不拿“够不够好”来衡量，你会怎么描述现在的自己？'],
    loss: ['你舍不得的到底是这个人，还是那段关系里你以为自己会拥有的以后？', '如果不急着让自己释怀，今天你最想承认的遗憾是什么？'],
    general: ['这件事里，你最不想承认的那一小块是什么？', '如果不急着给结论，你觉得哪里最值得再看一眼？']
  };
  const signalLine = signals && (signals.emotions.length || signals.needs.length || signals.causes.length || signals.intent.length)
    ? `你这次不是只在问牌。里面有${signals.emotions.length ? tarotSignalNames(signals.emotions) : '一些情绪'}，也夹着${signals.causes.length ? tarotSignalNames(signals.causes) : '一个很具体的卡点'}；你大概更想要的是${signals.intent.length ? tarotSignalNames(signals.intent) : (signals.needs.length ? tarotSignalNames(signals.needs) : '一个能落地的说法')}。`
    : '';
  const keywords = cards.flatMap(card => card.keywords || []).slice(0, 3).join('、') || first.name;
  const cardLine = buildCardBreakdown(cards, question);
  const spreadLine = cards.length > 1 ? buildSpreadSynthesis(cards, spreadName, question) : '';
  return {
    reply: [tarotCauseLine(signals, seed), tarotPick(openings[kind], seed), signalLine, cardLine, spreadLine, tarotPick([
      '先把最别扭的那一块单独拎出来，别让它带着整个人生一起开会。',
      '这事不用今天就讲到结局，先把眼下最卡的地方看清就够了。'
    ], seed + last.name)].filter(Boolean).join('\n\n'),
    plainSummary: tarotPick([
      `先别把它升级成人生大题，看看“${keywords}”这块是不是一直没人认真碰。`,
      '先把最别扭的地方说清楚，答案不用今天一次性长出来。'
    ], seed),
    reflectionQuestion: tarotIntentQuestion(signals, tarotPick(questions[kind], seed), seed)
  };
}

const ALLOWED_ORIGINS = [
  'https://latte7-9.github.io',
  'http://localhost:8760',
  'http://127.0.0.1:8760'
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
};

let weeklyCache = null;
let cacheTimer = null;
let fmStore = loadStore();
const rateMap = new Map();

function defaultStore() {
  return {
    library: [],
    libraryUpdatedAt: null,
    libraryScope: null,
    sessions: [],
    generationLogs: []
  };
}

function loadStore() {
  try {
    if (!fs.existsSync(DB_PATH)) return defaultStore();
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    return Object.assign(defaultStore(), parsed);
  } catch (e) {
    console.warn('[FM] store load failed:', e.message);
    return defaultStore();
  }
}

function saveStore() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(fmStore, null, 2), 'utf8');
}

function getOrigin(req) {
  const o = req.headers.origin || '';
  return ALLOWED_ORIGINS.includes(o) ? o : ALLOWED_ORIGINS[0];
}

function sendJSON(res, data, status = 200, origin) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-FM-Token',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}

function sanitizeText(value, max = 400) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function makeId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
}

function getClientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return String(forwarded || req.socket.remoteAddress || 'local').split(',')[0].trim();
}

function rateLimit(req, bucket, limit, windowMs) {
  const key = bucket + ':' + getClientKey(req);
  const now = Date.now();
  const item = rateMap.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > item.resetAt) {
    item.count = 0;
    item.resetAt = now + windowMs;
  }
  item.count += 1;
  rateMap.set(key, item);
  return item.count <= limit;
}

function isAuthed(req) {
  if (!ADMIN_TOKEN) return false;
  const header = req.headers.authorization || '';
  const token = req.headers['x-fm-token'] || header.replace(/^Bearer\s+/i, '');
  return token === ADMIN_TOKEN;
}

function normalizeSong(song, extra = {}) {
  const album = song.al || song.album || {};
  const artists = song.ar || song.artists || [];
  return Object.assign({
    id: String(song.id || song.songId || extra.id || ''),
    name: song.name || extra.name || '未知歌曲',
    artists: Array.isArray(artists) ? artists.map(a => a.name || a).join(' / ') : String(artists || extra.artists || '未知歌手'),
    album: album.name || extra.album || '',
    cover: album.picUrl || song.picUrl || extra.cover || '',
    duration: song.dt || song.duration || extra.duration || 0,
    url: 'https://music.163.com/#/song?id=' + encodeURIComponent(song.id || song.songId || extra.id || '')
  }, extra);
}

async function refreshWeeklyCache() {
  try {
    const r = await callNetease('user_record', { uid: UID, type: 1 });
    const rows = Array.isArray(r.weekData) ? r.weekData : [];
    if (r.code === 200 && rows.length > 0) {
      const songs = rows.slice(0, 10).map((item, index) => Object.assign(
        normalizeSong(item.song),
        { weeklyRank: index + 1, playCount: item.playCount || 0 }
      ));
      weeklyCache = { songs, updatedAt: new Date().toISOString(), status: 'live' };
      console.log('[??] ???????,', songs.length, '?');
      return;
    }
    const cachedSongs = (fmStore.library || [])
      .filter(song => song.source === 'weekly' || song.source === 'liked+weekly')
      .sort((a, b) => Number(a.weeklyRank || Infinity) - Number(b.weeklyRank || Infinity))
      .slice(0, 10)
      .map((song, index) => Object.assign({}, song, { weeklyRank: song.weeklyRank || index + 1, playCount: song.playCount || 0 }));
    if (cachedSongs.length) {
      weeklyCache = { songs: cachedSongs, updatedAt: fmStore.libraryUpdatedAt || new Date().toISOString(), status: 'cached' };
      console.warn('[??] ???????????????????', cachedSongs.length, '?');
      return;
    }
    console.warn('[??] ?????????????????');
  } catch (e) {
    const cachedSongs = (fmStore.library || [])
      .filter(song => song.source === 'weekly' || song.source === 'liked+weekly')
      .sort((a, b) => Number(a.weeklyRank || Infinity) - Number(b.weeklyRank || Infinity))
      .slice(0, 10);
    if (cachedSongs.length) {
      weeklyCache = { songs: cachedSongs, updatedAt: fmStore.libraryUpdatedAt || new Date().toISOString(), status: 'cached' };
      console.warn('[??] ?????????????????:', e.message);
      return;
    }
    console.error('[??] ????????:', e.message);
  }
}

function startCacheTimer() {
  if (cacheTimer) clearInterval(cacheTimer);
  refreshWeeklyCache();
  cacheTimer = setInterval(refreshWeeklyCache, CACHE_TTL);
}

async function fetchPlaylistSongs(id, source) {
  let body;
  if (typeof netease.playlist_track_all === 'function') {
    body = await callNetease('playlist_track_all', { id, limit: 5000, offset: 0 });
  } else {
    body = await callNetease('playlist_detail', { id });
  }
  return (body.songs || (body.playlist && body.playlist.tracks) || []).map(song => normalizeSong(song, {
    source: source,
    sourcePlaylistId: String(id)
  }));
}

async function fetchWeeklySongs() {
  const body = await callNetease('user_record', { uid: UID, type: 1 });
  const rows = body.weekData || [];
  return rows.map((item, index) => Object.assign(normalizeSong(item.song || {}, {
    source: 'weekly',
    weeklyRank: index + 1,
    playCount: item.playCount || 0
  }), { weeklyRank: index + 1, playCount: item.playCount || 0 }));
}

async function refreshLibrary() {
  const byId = new Map();
  let liked = [];
  let weekly = [];
  try {
    liked = await fetchPlaylistSongs(LIKED_PLAYLIST_ID, 'liked');
  } catch (e) {
    console.warn('[FM] liked playlist refresh failed:', e.message);
  }
  try {
    weekly = await fetchWeeklySongs();
  } catch (e) {
    console.warn('[FM] weekly record refresh failed:', e.message);
  }

  liked.forEach(song => byId.set(String(song.id), song));
  weekly.forEach(song => {
    const existing = byId.get(String(song.id));
    byId.set(String(song.id), Object.assign({}, existing || song, song, {
      source: existing ? 'liked+weekly' : 'weekly'
    }));
  });

  const songs = Array.from(byId.values());
  if (!songs.length) throw new Error('无法读取“我喜欢的音乐”或最近常听排行');
  fmStore.library = songs;
  fmStore.libraryUpdatedAt = new Date().toISOString();
  fmStore.libraryScope = 'liked-plus-weekly';
  saveStore();
  return songs;
}

async function ensureLibrary() {
  if (fmStore.library && fmStore.library.length && fmStore.libraryScope === 'liked-plus-weekly') return fmStore.library;
  return refreshLibrary();
}

function pickCandidates(library, context) {
  const seed = context.raw + ':' + new Date().toISOString().slice(0, 10);
  const rank = songs => songs
    .map(song => Object.assign({}, song, { _score: scoreSong(song, context, seed) }))
    .sort((a, b) => b._score - a._score);
  const weekly = rank(library.filter(song => song.source === 'weekly' || song.source === 'liked+weekly'));
  const liked = rank(library.filter(song => song.source === 'liked' || song.source === 'liked+weekly'));
  const selected = [];
  const seen = new Set();
  weekly.slice(0, 6).forEach(song => {
    if (!seen.has(song.id)) {
      selected.push(song);
      seen.add(song.id);
    }
  });
  liked.forEach(song => {
    if (selected.length >= 120 || seen.has(song.id)) return;
    selected.push(song);
    seen.add(song.id);
  });
  return selected.slice(0, 120);
}
function parseMoodWeather(prompt) {
  const text = sanitizeText(prompt, 600);
  const weatherWords = ['晴', '雨', '阴', '雪', '风', '热', '冷', '雾', '潮', '湿', '雷', '台风', '多云'];
  const moodWords = ['开心', '难过', '疲惫', '焦虑', '平静', '兴奋', '失眠', '想念', '孤独', '浪漫', '松弛', '低落', '释怀'];
  return {
    raw: text,
    weather: weatherWords.filter(w => text.includes(w)).slice(0, 3).join(' / ') || '访客描述中的天气',
    mood: moodWords.filter(w => text.includes(w)).slice(0, 4).join(' / ') || '访客描述中的心情',
    scene: text || '一段没有命名的心情天气'
  };
}


function scoreSong(song, context, seed) {
  const hay = (song.name + ' ' + song.artists + ' ' + song.album).toLowerCase();
  let score = seededRandom(seed + song.id) * 4;
  const text = context.raw.toLowerCase();
  ['雨', '夜', '风', '晴', '夏', '冬', '海', '月', '星', '爱', '梦', '光', '孤独', '快乐'].forEach(word => {
    if (text.includes(word) && hay.includes(word.toLowerCase())) score += 6;
    else if (hay.includes(word.toLowerCase())) score += 1;
  });
  if (/雨|阴|冷|低落|难过|孤独|失眠/.test(context.raw) && /夜|雨|寂寞|孤独|月|冬|蓝|慢/.test(hay)) score += 3;
  if (/晴|开心|兴奋|热|夏|出门/.test(context.raw) && /sun|夏|晴|快乐|dance|光|run|happy/i.test(hay)) score += 3;
  return score;
}

function seededRandom(input) {
  const hash = crypto.createHash('sha1').update(String(input)).digest();
  return hash.readUInt32BE(0) / 0xffffffff;
}

function fallbackPlaylist(context, candidates) {
  return {
    title: makeThemeTitle(context),
    mood: context.mood,
    weather: context.weather,
    summary: '\u4e3a\u300c' + context.scene + '\u300d\u6574\u7406\u7684 12 \u9996\u60c5\u7eea\u6b4c\u5355\u3002',
    songs: candidates.slice(0, 12)
  };
}

function makeThemeTitle(context) {
  if (/\u96e8/.test(context.raw)) return '\u96e8\u58f0\u91cc\u7684\u4e00\u5c0f\u6bb5\u6b4c\u5355';
  if (/\u6674|\u70ed|\u590f/.test(context.raw)) return '\u628a\u5149\u8c03\u9ad8\u4e00\u70b9';
  if (/\u96be\u8fc7|\u4f4e\u843d|\u5b64\u72ec|\u5931\u7720/.test(context.raw)) return '\u7ed9\u4eca\u665a\u7559\u4e00\u76cf\u5c0f\u706f';
  if (/\u5f00\u5fc3|\u5174\u594b/.test(context.raw)) return '\u4eca\u5929\u9002\u5408\u628a\u97f3\u91cf\u5f00\u4eae';
  return '\u6b64\u523b\u7684\u60c5\u7eea\u6b4c\u5355';
}

async function aiPlaylist(context, candidates) {
  return fallbackPlaylist(context, candidates);
}

function postJSON(hostname, requestPath, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const raw = JSON.stringify(payload);
    const req = https.request({
      hostname,
      path: requestPath,
      method: 'POST',
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(raw)
      }, headers)
    }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          if (res.statusCode >= 400) return reject(new Error(data.error && data.error.message || ('HTTP ' + res.statusCode)));
          resolve(data);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(raw);
    req.end();
  });
}

async function handleTarotReading(req, res, origin) {
  if (req.method !== 'POST') return sendJSON(res, { error: 'method not allowed' }, 405, origin);
  if (!rateLimit(req, 'tarot-reading', 12, 60 * 60 * 1000)) {
    return sendJSON(res, { error: '塔罗阅读请求过于频繁，请稍后再试。' }, 429, origin);
  }
  const body = await readBody(req);
  const question = sanitizeText(body.question || '', 240);
  const spreadName = sanitizeText(body.spreadName || body.spread || '单张牌', 40);
  const userSignals = analyzeTarotQuestion(question);
  const cards = Array.isArray(body.cards) ? body.cards.slice(0, 10).map(card => ({
    position: sanitizeText(card.position, 30),
    name: sanitizeText(card.name, 30),
    orientation: sanitizeText(card.orientation, 10),
    keywords: Array.isArray(card.keywords) ? card.keywords.slice(0, 5).map(k => sanitizeText(k, 18)) : [],
    meaning: sanitizeText(card.meaning, 180)
  })) : [];

  if (userSignals.risk) {
    return sendJSON(res, {
      reply: '你刚刚说的内容让我有点担心。现在先别一个人硬扛，也先不用急着从牌里找答案。能不能先联系一个你信得过的人，直接告诉他你现在不太安全、需要有人陪一下？如果你有马上伤害自己的冲动，请立刻联系当地紧急服务、医院急诊或心理危机支持热线。',
      plainSummary: '现在最重要的不是把事情想明白，是先让你身边有人知道你正在难受。',
      reflectionQuestion: '你现在能联系到的第一个人是谁？'
    }, 200, origin);
  }

  const fallback = tarotFallback(question, cards, spreadName, userSignals);
  if (!AI_API_KEY || !cards.length) return sendJSON(res, fallback, 200, origin);

  const payload = {
    model: AI_MODEL,
    messages: [
      {
        role: 'system',
        content: tarotSystemPrompt()
      },
      {
        role: 'user',
        content: JSON.stringify({ question, userSignals, spreadName, cards })
      }
    ],
    temperature: 0.88,
    response_format: { type: 'json_object' }
  };

  try {
    const response = await postJSON('api.openai.com', '/v1/chat/completions', payload, {
      Authorization: `Bearer ${AI_API_KEY}`
    });
    const content = response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content;
    const parsed = JSON.parse(content || '{}');
    const reply = sanitizeText(parsed.reply || '', 1800);
    const mentionsEveryCard = cards.every(card => reply.includes(card.name));
    const addressesQuestion = responseGroundedInQuestion(reply, question, userSignals);
    return sendJSON(res, {
      reply: mentionsEveryCard && addressesQuestion ? reply : fallback.reply,
      plainSummary: mentionsEveryCard && addressesQuestion ? sanitizeText(parsed.plainSummary || fallback.plainSummary, 260) : fallback.plainSummary,
      reflectionQuestion: mentionsEveryCard && addressesQuestion ? sanitizeText(parsed.reflectionQuestion || fallback.reflectionQuestion, 180) : fallback.reflectionQuestion
    }, 200, origin);
  } catch (e) {
    console.warn('[Tarot] AI fallback:', e.message);
    return sendJSON(res, fallback, 200, origin);
  }
}

async function handleTarotChat(req, res, origin) {
  if (req.method !== 'POST') return sendJSON(res, { error: 'method not allowed' }, 405, origin);
  if (!rateLimit(req, 'tarot-chat', 30, 60 * 60 * 1000)) return sendJSON(res, { error: '今天先聊到这里，晚点再回来。' }, 429, origin);
  const body = await readBody(req);
  const text = sanitizeText(body.text || '', 300);
  const cards = Array.isArray(body.cards) ? body.cards.slice(0, 10).map(card => ({
    position: sanitizeText(card.position, 30), name: sanitizeText(card.name, 30), orientation: sanitizeText(card.orientation, 10),
    keywords: Array.isArray(card.keywords) ? card.keywords.slice(0, 5).map(k => sanitizeText(k, 18)) : [], meaning: sanitizeText(card.meaning, 180)
  })) : [];
  const conversation = Array.isArray(body.conversation) ? body.conversation.slice(-12).map(item => ({
    role: item.role === 'assistant' ? 'assistant' : 'user', content: sanitizeText(item.content, 360)
  })) : [];
  const turn = analyzeTurn(text, conversation);
  const fallback = buildFallbackMessages({ text, conversation, cards });
  if (turn.mode === 'risk' || !AI_API_KEY) return sendJSON(res, { messages: fallback }, 200, origin);
  const payload = {
    model: AI_MODEL,
    messages: [{ role: 'system', content: tarotSystemPrompt() + '\n现在是在连续聊天，不是写报告。每轮只返回 JSON：{"messages":[{"text":"...","cardName":"可选"}]}。只发 1-3 条短消息；有时说完就停，不强制提问。允许转话题，牌只有相关时才提。不要复述上一轮牌义或重复口头禅。' }, {
      role: 'user', content: JSON.stringify({ text, conversation, cards, turn })
    }],
    temperature: 0.9,
    response_format: { type: 'json_object' }
  };
  try {
    const response = await postJSON('api.openai.com', '/v1/chat/completions', payload, { Authorization: `Bearer ${AI_API_KEY}` });
    const parsed = JSON.parse(response.choices?.[0]?.message?.content || '{}');
    const messages = Array.isArray(parsed.messages) ? parsed.messages.slice(0, 3).map(item => ({ text: sanitizeText(item.text, 500), cardName: sanitizeText(item.cardName, 30) })).filter(item => item.text) : [];
    return sendJSON(res, { messages: messages.length ? messages : fallback }, 200, origin);
  } catch (e) {
    console.warn('[Tarot] chat fallback:', e.message);
    return sendJSON(res, { messages: fallback }, 200, origin);
  }
}

async function handleTarotIntake(req, res, origin) {
  if (req.method !== 'POST') return sendJSON(res, { error: 'method not allowed' }, 405, origin);
  const body = await readBody(req);
  const conversation = Array.isArray(body.conversation) ? body.conversation.slice(-4).map(item => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: sanitizeText(item.content, 300) })) : [];
  const fallback = decideIntake(conversation);
  if (!AI_API_KEY) return sendJSON(res, fallback, 200, origin);
  const payload = { model: AI_MODEL, messages: [{ role: 'system', content: '你是 LATTE。用户还没抽牌。先判断信息是否足够抽牌；最多追问两轮，每次只问一个从用户原话长出来的具体问题。不要分析、安慰或解释塔罗。返回 JSON：{"ready":boolean,"message":"短句"}。' }, { role: 'user', content: JSON.stringify({ conversation, fallback }) }], temperature: 0.8, response_format: { type: 'json_object' } };
  try {
    const response = await postJSON('api.openai.com', '/v1/chat/completions', payload, { Authorization: `Bearer ${AI_API_KEY}` });
    const parsed = JSON.parse(response.choices?.[0]?.message?.content || '{}');
    return sendJSON(res, { ready: typeof parsed.ready === 'boolean' ? parsed.ready : fallback.ready, message: sanitizeText(parsed.message || fallback.message, 300) }, 200, origin);
  } catch (e) { return sendJSON(res, fallback, 200, origin); }
}

async function handleFM(req, res, url, origin) {
  const p = url.pathname;

  if (p === '/api/fm/library/refresh' && req.method === 'POST') {
    if (!isAuthed(req)) return sendJSON(res, { error: 'unauthorized' }, 401, origin);
    if (url.searchParams.get('force') === '1') {
      fmStore.library = [];
      fmStore.libraryUpdatedAt = null;
    }
    const songs = await refreshLibrary();
    return sendJSON(res, { ok: true, songCount: songs.length, updatedAt: fmStore.libraryUpdatedAt }, 200, origin);
  }

  if (p === '/api/fm/session' && req.method === 'POST') {
    if (!rateLimit(req, 'fm-session', 5, 60 * 60 * 1000)) {
      return sendJSON(res, { error: '生成太频繁了，稍后再试。' }, 429, origin);
    }
    const body = await readBody(req);
    const context = parseMoodWeather(body.prompt || body.text || '');
    if (context.raw.length < 4) return sendJSON(res, { error: '请写下心情、天气或近况，再生成歌单。' }, 400, origin);
    const library = await ensureLibrary();
    const candidates = pickCandidates(library, context);
    const generated = await aiPlaylist(context, candidates);
    const session = {
      id: makeId('fm'),
      createdAt: new Date().toISOString(),
      prompt: context.raw,
      title: generated.title,
      mood: generated.mood,
      weather: generated.weather,
      summary: generated.summary || '为此刻整理的 12 首情绪歌单。',
      songs: generated.songs.map((song, index) => Object.assign({}, song, { order: index + 1 })),
      public: false
    };
    fmStore.sessions.unshift(session);
    fmStore.sessions = fmStore.sessions.slice(0, 300);
    fmStore.generationLogs.unshift({ id: session.id, createdAt: session.createdAt, prompt: context.raw, songCount: session.songs.length });
    fmStore.generationLogs = fmStore.generationLogs.slice(0, 300);
    saveStore();
    return sendJSON(res, { ok: true, session }, 200, origin);
  }

  const sessionMatch = p.match(/^\/api\/fm\/session\/([^/]+)$/);
  if (sessionMatch && req.method === 'GET') {
    const session = fmStore.sessions.find(item => item.id === sessionMatch[1]);
    return sendJSON(res, session ? { ok: true, session } : { error: 'not found' }, session ? 200 : 404, origin);
  }


  return null;
}

function serveStatic(req, res) {
  let requestPath = req.url.split('?')[0];
  try { requestPath = decodeURIComponent(requestPath); }
  catch (e) { res.writeHead(400); return res.end('Bad request'); }
  if (requestPath === '/') requestPath = '/index.html';
  const filePath = path.join(__dirname, requestPath);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (!err) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      return res.end(data);
    }
    if (!path.extname(filePath)) {
      const indexPath = path.join(filePath, 'index.html');
      fs.readFile(indexPath, (err2, data2) => {
        if (!err2) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
          return res.end(data2);
        }
        res.writeHead(404);
        res.end('404');
      });
      return;
    }
    res.writeHead(404);
    res.end('404');
  });
}

const server = http.createServer(async (req, res) => {
  const origin = getOrigin(req);
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-FM-Token'
      });
      return res.end();
    }

    if (p === '/health') {
      return sendJSON(res, {
        status: 'ok',
        fm: {
          librarySongs: fmStore.library.length,
          sessions: fmStore.sessions.length,
          playlistMode: 'emotion-recommendations'
        }
      }, 200, origin);
    }

    if (p === '/api/tarot/reading') {
      return await handleTarotReading(req, res, origin);
    }
    if (p === '/api/tarot/chat') {
      return await handleTarotChat(req, res, origin);
    }
    if (p === '/api/tarot/intake') {
      return await handleTarotIntake(req, res, origin);
    }

    if (p.startsWith('/api/fm/')) {
      const handled = await handleFM(req, res, url, origin);
      if (handled !== null) return;
    }

    if (p === '/api/netease/weekly') {
      if (weeklyCache && weeklyCache.songs.length > 0) return sendJSON(res, weeklyCache, 200, origin);
      await refreshWeeklyCache();
      return sendJSON(res, weeklyCache || { error: '暂无数据', songs: [] }, 200, origin);
    }

    if (p === '/api/netease/random') {
      if (!weeklyCache || !weeklyCache.songs || weeklyCache.songs.length === 0) await refreshWeeklyCache();
      const songs = (weeklyCache && weeklyCache.songs) || [];
      if (songs.length === 0) return sendJSON(res, { error: '暂无数据' }, 200, origin);
      const song = songs[Math.floor(Math.random() * songs.length)];
      return sendJSON(res, { song }, 200, origin);
    }

    if (p === '/api/netease/status') {
      return sendJSON(res, {
        ok: true,
        uid: UID,
        cachedAt: weeklyCache ? weeklyCache.updatedAt : null,
        songCount: weeklyCache ? weeklyCache.songs.length : 0,
        fmLibrarySongs: fmStore.library.length,
        fmLibraryUpdatedAt: fmStore.libraryUpdatedAt
      }, 200, origin);
    }

    if (p === '/api/netease/sync' && req.method === 'POST') {
      await refreshWeeklyCache();
      return sendJSON(res, { ok: true, songCount: weeklyCache ? weeklyCache.songs.length : 0 }, 200, origin);
    }

    if (p.startsWith('/api/')) return sendJSON(res, { error: 'not found' }, 404, origin);
    return serveStatic(req, res);
  } catch (e) {
    console.error('[API] error:', e);
    return sendJSON(res, { error: e.message || 'server error' }, 500, origin);
  }
});

server.listen(PORT, () => {
  console.log('Latte FM API running on port', PORT);
  startCacheTimer();
});
