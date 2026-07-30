function score(seed) {
  return Array.from(String(seed || '')).reduce((total, char) => total + char.charCodeAt(0), 0);
}

function pick(lines, seed) {
  return lines[score(seed) % lines.length];
}

function orientationNote(card) {
  return card.orientation === '逆位'
    ? '逆位让它更像一处暂时卡住的地方，先别硬推。'
    : '正位说明这部分并非没有抓手，只是还需要你把它用起来。';
}

function userBridge(question, card) {
  const text = String(question || '');
  const keywords = (card.keywords || []).slice(0, 2).join('、') || card.name;
  if (/选错|选择|方向|决定|后悔/.test(text)) {
    return `放进你担心“选错”的这件事里，它说的不是替你选路，而是先看看“${keywords}”这一块有没有被你跳过。`;
  }
  if (/不回|消失|关系|感情|喜欢|他|她/.test(text)) {
    return `放进这段关系里，它更像在问：${keywords}，到底是谁在一边等、一边自己补台。`;
  }
  if (/累|堆|耗|撑不住|工作|学习/.test(text)) {
    return `放进你现在这股累里，它提醒你：${keywords}不是靠再多扛一点就会自动解决的。`;
  }
  if (/不够好|自卑|没用|敏感|忽略/.test(text)) {
    return `放进你对自己的怀疑里，它像是在把“${keywords}”从“我是不是不够好”这道题里先拆出来。`;
  }
  return `放进你刚刚给出的方向里，它把“${keywords}”这块照得更亮了一点。`;
}

function buildCardBreakdown(cards, question) {
  return (cards || []).map((card) => {
    const meaning = card.meaning || '这张牌留下了一个值得慢一点看的角度。';
    return `${card.position}的${card.name}（${card.orientation}）：${meaning}${orientationNote(card)}${userBridge(question, card)}`;
  }).join('\n\n');
}

function buildSpreadSynthesis(cards, spreadName, question) {
  const names = (cards || []).map((card) => card.name).join('、');
  const reversed = (cards || []).filter((card) => card.orientation === '逆位').length;
  const direction = /选错|选择|方向|决定|后悔/.test(String(question || ''))
    ? '它们不是在替你选哪条路，而是在把“先从哪里看、再怎么走”拆开。'
    : '它们不是在替你下结论，而是在把同一件事里不同的部分摊开。';
  const orientation = reversed
    ? `里面有${reversed}张逆位，所以有些环节目前不适合拿蛮力硬顶。`
    : '这组牌都是正位，说明事情并非没有可动的地方。';
  return `${spreadName}里，${names}不是三个人轮流发言。${direction}${orientation}`;
}

module.exports = { buildCardBreakdown, buildSpreadSynthesis };
