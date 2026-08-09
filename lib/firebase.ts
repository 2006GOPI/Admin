import { db, collection, getDocs } from '../firebase';

export const fetchFirebaseCollection = async <T = any>(name: string): Promise<T[]> => {
  try {
    const snapshot = await getDocs(collection(db, name));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as T[];
  } catch (error) {
    console.error(`Error fetching collection "${name}":`, error);
    return [];
  }
};
