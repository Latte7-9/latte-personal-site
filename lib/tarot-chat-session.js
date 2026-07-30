const RISK = /不想活|想死|自杀|自残|结束自己|伤害自己|活不下去/;
const TOPIC = {
  interview: /面试|入职|offer|找工作/,
  relationship: /感情|关系|喜欢|分手|不回|他|她/,
  work: /工作|上班|老板|同事|项目/,
  choice: /选择|方向|要不要|该不该|选错/,
  tired: /累|撑不住|耗|失眠|烦/,
  selfWorth: /不够好|自卑|没用|敏感|失败/
};

function topics(text) {
  return Object.keys(TOPIC).filter((key) => TOPIC[key].test(String(text || '')));
}

function analyzeTurn(text, conversation) {
  if (RISK.test(String(text || ''))) return { mode: 'risk', topics: [] };
  const current = topics(text);
  const prior = topics((conversation || []).filter((item) => item.role === 'user').map((item) => item.content).join(' '));
  const newTopic = current.some((topic) => !prior.includes(topic));
  if (newTopic && prior.length) return { mode: 'topic_shift', topics: current };
  if (/你觉得|到底|是不是|能不能|该不该/.test(String(text || ''))) return { mode: 'decision', topics: current };
  if (/还是|又|一直|反复|每次/.test(String(text || ''))) return { mode: 'loop', topics: current };
  if (/难过|委屈|烦|累|害怕|慌|孤独/.test(String(text || ''))) return { mode: 'emotion', topics: current };
  return { mode: 'detail', topics: current };
}

function recentStarts(conversation) {
  return (conversation || []).filter((item) => item.role === 'assistant').slice(-4).map((item) => String(item.content || '').slice(0, 8));
}

function buildFallbackMessages({ text, conversation, cards }) {
  const turn = analyzeTurn(text, conversation);
  if (turn.mode === 'risk') return [{ text: '你刚刚说的内容让我有点担心。先别一个人扛，也先不用从牌里找答案。请马上联系一个你信得过的人；如果你有立刻伤害自己的冲动，请联系当地紧急服务、医院急诊或心理危机支持。' }];
  const starts = recentStarts(conversation);
  const options = {
    topic_shift: ['面试这件事我们先单独拿出来，不用硬把它塞回刚才的话题里。突然慌一下很正常，毕竟脑子会先替你把明天演成事故片。', '这个新话题先接住。牌还在旁边，不急着让它抢话。'],
    decision: ['我不替你拍“辞”还是“不辞”这个板，毕竟最后背锅的又不是我。你更怕失去的是钱和稳定，还是继续待下去以后越来越看不起自己？'],
    loop: ['你又绕回这里，可能不是因为你没想明白，是那个答案一旦落地，后面就得真的动。人对“要开始干活”这件事，向来很会装听不见。'],
    emotion: ['这句先别急着讲道理。你已经被这事磨得够烦了，事情本身还没散场，脑子倒是先被迫加班。'],
    detail: ['你刚刚补的这个细节挺关键。它让前面那件事不再只是一个模糊的“我不舒服”。']
  };
  let first = options[turn.mode][0];
  if (starts.some((start) => first.startsWith(start))) first = options[turn.mode][1] || '我先把你这句话放在这里，不急着替它下结论。';
  const result = [{ text: first }];
  const card = (cards || [])[0];
  if (card && turn.mode !== 'topic_shift') result.push({ text: `${card.name}这次可以放在旁边当一个观察点：${card.meaning || (card.keywords || []).join('、')}。不必每句话都拉它出来解释。`, cardName: card.name });
  return result.slice(0, 3);
}

module.exports = { analyzeTurn, buildFallbackMessages };
