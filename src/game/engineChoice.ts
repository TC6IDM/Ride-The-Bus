const resolvers = new Map<number, (choice: any) => void>();

export function waitForChoice(index: number) {
  return new Promise<any>((resolve) => {
    resolvers.set(index, resolve);
  });
}

export function sendChoice(index: number, choice: any) {
  const resolver = resolvers.get(index);
  if (resolver) {
    resolver(choice);
    resolvers.delete(index);
    return true;
  }
  return false;
}

export function hasPendingChoice(index: number) {
  return resolvers.has(index);
}
