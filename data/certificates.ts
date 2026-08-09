import { fetchFirebaseCollection } from '../lib/firebase';
import type { Certificate } from '../types/certificate';

export const getCertificates = async (): Promise<Certificate[]> => {
  return fetchFirebaseCollection<Certificate>('certificates');
};
