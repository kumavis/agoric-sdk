export function buildRootObject() {
  let counter = 0;
  const root = {
    increment() {
      return counter += 1;
    },
    read() {
      return counter;
    },
  };
  return harden(root);
}