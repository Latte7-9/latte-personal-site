function userTurns(conversation) {
  return (conversation || []).filter((item) => item.role === 'user');
}

function decideIntake(conversation) {
  const turns = userTurns(conversation);
  const text = String((turns[turns.length - 1] || {}).content || '').trim();
  const detailed = text.length >= 20 && /(感情|工作|关系|考试|家里|最近|一直|因为|但是|害怕|生气|难过|累)/.test(text);

  if (turns.length >= 2 || detailed) {
    return {
      ready: true,
      message: '行，这次不是泛泛的难受了。我大概知道牌该往哪里照，来抽。'
    };
  }

  if (/痛苦|难受|崩溃|焦虑|累|迷茫/.test(text)) {
    return {
      ready: false,
      message: '先别急着给它起一个很大的名字。最近是哪件事，或者哪个瞬间，最让你觉得撑不住？'
    };
  }

  return {
    ready: false,
    message: '这个方向我先记下了。你最怕它最后变成什么样？'
  };
}

module.exports = { decideIntake };
