export interface DocumentRecord {
  id: string;
  missionId: string;
  stopId: string | null;
  type: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verificationNotes: string | null;
  createdAt: string;
  mission: { id: string; missionNo: string };
  stop: { id: string; sequence: number } | null;
  uploadedBy: { id: string; name: string };
  verifiedBy: { id: string; name: string } | null;
}

export interface PaginatedDocuments {
  data: DocumentRecord[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
