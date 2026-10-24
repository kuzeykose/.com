export function createPool(createFn, resetFn = () => {}) {
  const free = [];

  function acquire() {
    if (free.length > 0) {
      return free.pop();
    }
    return createFn();
  }

  function release(item) {
    resetFn(item);
    free.push(item);
  }

  function size() {
    return free.length;
  }

  return {
    acquire,
    release,
    size,
  };
}
