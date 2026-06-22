declare global {
  namespace Express {
    interface Request {
      officer?: {
        badgeNumber: string;
        fullName: string;
        department: string;
      };
    }
  }
}

export {};
