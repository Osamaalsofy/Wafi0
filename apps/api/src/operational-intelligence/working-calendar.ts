export const CONTINUOUS_WORKING_CALENDAR = {
  mode: 'CONTINUOUS_24_7',
  operatingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
  pauseSlaOnWeekends: false,
  pauseSlaOnOfficialHolidays: false,
  holidayWorkClassification: 'OVERTIME',
} as const;
