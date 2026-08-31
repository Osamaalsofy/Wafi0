export interface DigitalWaybill {
  status: 'DRAFT' | 'ISSUED'; waybillNumber: string; issuedAt: string | null; date: string; missionNo: string;
  verificationToken: string | null;
  client: string; source: string; sourceAddress: string | null; consignee: string | null; destinationAddress: string | null;
  route: string | null; city: string | null; carrier: string | null; driverName: string | null;
  driverNationalId: string | null; driverPhone: string | null; vehicleNumber: string | null; vehicleType: string | null;
  freightValue: string | null; typeOfGoods: string | null; notes: string | null;
  times: { arrival: string | null; loaded: string | null; exit: string | null; breaks: string | null };
  receipt: { receivedAt: string | null; receiverName: string | null };
  declaration: { ar: string; en: string }; insuranceNote: { ar: string; en: string };
}

export interface PublicWaybillVerification {
  verificationStatus: 'VALID' | 'COMPLETED' | 'CANCELLED' | 'SUPERSEDED';
  waybillNumber: string | null;
  issueDate: string | null;
  client: string | null;
  source: string | null;
  destination: string | null;
  driverName: string | null;
  vehicleNumber: string | null;
  carrier: string | null;
  typeOfGoods: string | null;
  missionReference: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  deliveryTime: string | null;
  waybillStatus: string | null;
  tripStatus: string;
  deliveryProofStatus: string;
  closureStatus: string;
}
