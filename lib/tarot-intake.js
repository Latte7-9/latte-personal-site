function userTurns(conversation) {
  return (conversation || []).filter((item) => item.role === 'user');
}

function decideIntake(conversation) {
  const turns = userTurns(conversation);
  const text = String((turns[turns.length - 1] || {}).content || '').trim();
  const detailed = text.length >= 20 && /(感情|工作|关系|考试|家里|最近|一直|因为|但是|害怕|生气|难过|失恋|事业|累)/.test(text);

  if (turns.length >= 2 || detailed) {
    return { ready: true, message: '行，线索够了。牌阵在这儿，你挑一种。' };
  }
  if (/事业|工作|上班|老板|同事/.test(text)) {
    return { ready: false, message: '事业不顺心这个筐有点大。是事情推不动，还是人已经把你推得想翻白眼？' };
  }
  if (/失恋|分手|感情|喜欢|前任/.test(text)) {
    return { ready: false, message: '是舍不得那个人，还是不甘心这段关系就这么收场？' };
  }
  if (/痛苦|难受|崩溃|焦虑|累|迷茫/.test(text)) {
    return { ready: false, message: '最近是哪件事，或者哪个瞬间，最让你觉得撑不住？' };
  }
  return { ready: false, message: '这个方向先记下。你最怕它最后变成什么样？' };
}

module.exports = { decideIntake };
