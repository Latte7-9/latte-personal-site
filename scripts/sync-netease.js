const fs = require('fs');
const path = require('path');

const uid = process.env.NETEASE_UID || '547894281';
const outputPath = path.join(__dirname, '..', 'data', 'currently.json');

function normalizeSong(item, index) {
  const song = item.song || {};
  const artists = Array.isArray(song.ar) ? song.ar : (song.artists || []);
  const album = song.al || song.album || {};
  const id = Number(song.id || 0);
  return {
    id,
    name: song.name || '',
    artists: artists.map((artist) => artist.name).filter(Boolean).join(' / '),
    cover: String(album.picUrl || '').replace(/^http:/, 'https:'),
    playCount: Number(item.playCount || 0),
    weeklyRank: index + 1,
    url: `https://music.163.com/#/song?id=${id}`
  };
}

function sameSongs(left, right) {
  return JSON.stringify(left || []) === JSON.stringify(right || []);
}

async function main() {
  const response = await fetch(`https://music.163.com/api/v1/play/record?uid=${encodeURIComponent(uid)}&type=1`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LattePersonalSite/1.0)',
      Referer: 'https://music.163.com/'
    }
  });
  if (!response.ok) throw new Error(`网易云接口返回 HTTP ${response.status}`);

  const data = await response.json();
  if (data.code !== 200 || !Array.isArray(data.weekData)) {
    throw new Error(`网易云接口返回异常：${data.code || 'unknown'}`);
  }

  const songs = data.weekData.slice(0, 10).map(normalizeSong);
  if (!songs.length) throw new Error('公开主页暂时没有可用的最近听歌记录');

  let current = { netease: { songs: [] } };
  if (fs.existsSync(outputPath)) current = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  const previousSongs = current.netease && current.netease.songs;
  if (sameSongs(previousSongs, songs)) {
    console.log('最近常听没有变化，无需更新。');
    return;
  }

  current.netease = {
    songs,
    updatedAt: new Date().toISOString(),
    status: 'public-profile'
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
  console.log(`已同步网易云用户 ${uid} 的 ${songs.length} 首最近常听。`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
