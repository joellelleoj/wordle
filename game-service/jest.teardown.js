module.exports = async () => {
  const timers = setTimeout(() => {}, 0);
  clearTimeout(timers);

  if (global.gc) {
    global.gc();
  }

  await new Promise((resolve) => setTimeout(resolve, 100));
};
