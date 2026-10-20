const { LEVELS } = require("../../src/levels/index.js");

Page({
  data: {
    levels: LEVELS.map((l, i) => ({ index: i, name: l.name })),
  },
  start(e) {
    const i = e.currentTarget.dataset.index;
    wx.navigateTo({ url: "/pages/game/game?index=" + i });
  },
});
