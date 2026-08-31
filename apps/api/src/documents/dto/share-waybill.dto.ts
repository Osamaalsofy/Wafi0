import { IsEnum } from 'class-validator';
export enum WaybillShareTarget { DRIVER = 'DRIVER', CLIENT = 'CLIENT' }
export class ShareWaybillDto { @IsEnum(WaybillShareTarget) target!: WaybillShareTarget; }
