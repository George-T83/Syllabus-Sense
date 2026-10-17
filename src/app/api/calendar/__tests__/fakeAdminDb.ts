/** Minimal in-memory stand-in for the slice of the admin Firestore API the calendar routes use. */
export type Store = Map<string, Record<string, unknown>>;

export function createFakeAdminDb(store: Store, onRead?: () => void) {
  const docsIn = (collectionPath: string, filter?: (d: Record<string, unknown>) => boolean) => {
    onRead?.();
    return [...store.entries()]
      .filter(([path]) => path.split('/').slice(0, -1).join('/') === collectionPath)
      .filter(([, data]) => (filter ? filter(data) : true))
      .map(([path, data]) => ({
        id: path.split('/').pop() as string,
        data: () => data,
        ref: { delete: async () => void store.delete(path) },
      }));
  };

  const query = (collectionPath: string, filter?: (d: Record<string, unknown>) => boolean) => ({
    get: async () => ({ docs: docsIn(collectionPath, filter) }),
    where: (field: string, _op: string, value: unknown) =>
      query(collectionPath, (d) => d[field] === value),
    limit: (n: number) => ({
      get: async () => ({ docs: docsIn(collectionPath, filter).slice(0, n) }),
    }),
  });

  return {
    collection: (collectionPath: string) => ({
      ...query(collectionPath),
      doc: (id: string) => {
        const path = `${collectionPath}/${id}`;
        return {
          get: async () => {
            onRead?.();
            return { exists: store.has(path), data: () => store.get(path) };
          },
          create: async (data: Record<string, unknown>) => {
            if (store.has(path)) throw new Error('already exists');
            store.set(path, data);
          },
        };
      },
    }),
  };
}
