declare global {
  namespace Express {
    interface Request {
      admin?: import('./index.js').AdminTokenPayload;
      officer?: {
        badgeNumber: string;
        fullName: string;
        department: string;
        unit?: string | null;
      };
    }
  }
}

export {};
