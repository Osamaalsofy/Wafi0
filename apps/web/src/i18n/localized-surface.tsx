'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n } from './i18n-provider';

const arabic: Record<string, string> = {
  Create: 'إنشاء',
  Edit: 'تعديل',
  Save: 'حفظ',
  'Save changes': 'حفظ التغييرات',
  Close: 'إغلاق',
  Cancel: 'إلغاء',
  Apply: 'تطبيق',
  Search: 'بحث',
  Retry: 'إعادة المحاولة',
  Status: 'الحالة',
  Actions: 'الإجراءات',
  Name: 'الاسم',
  Code: 'الرمز',
  Created: 'تاريخ الإنشاء',
  Updated: 'آخر تحديث',
  Previous: 'السابق',
  Next: 'التالي',
  'Loading…': 'جارٍ التحميل…',
  All: 'الكل',
  Active: 'نشط',
  Inactive: 'غير نشط',
  Archived: 'مؤرشف',
  Activate: 'تفعيل',
  Deactivate: 'تعطيل',
  Archive: 'أرشفة',
  Download: 'تنزيل',
  Upload: 'رفع',
  Verify: 'اعتماد',
  Reject: 'رفض',
  Pending: 'قيد الانتظار',
  Verified: 'معتمد',
  Rejected: 'مرفوض',
  Mission: 'المهمة',
  Missions: 'المهام',
  Client: 'العميل',
  Clients: 'العملاء',
  Warehouse: 'المستودع',
  Warehouses: 'المستودعات',
  Branch: 'الفرع',
  Branches: 'الفروع',
  Carrier: 'شركة النقل',
  Carriers: 'شركات النقل',
  Driver: 'السائق',
  Drivers: 'السائقون',
  Vehicle: 'المركبة',
  Vehicles: 'المركبات',
  Contract: 'العقد',
  Contracts: 'العقود',
  Route: 'المسار',
  Routes: 'المسارات',
  Documents: 'المستندات',
  Exceptions: 'الاستثناءات',
  Alerts: 'التنبيهات',
  Reports: 'التقارير',
  Audit: 'سجل التدقيق',
  Users: 'المستخدمون',
  Permissions: 'الصلاحيات',
  Role: 'الدور',
  Rules: 'القواعد',
  KPI: 'مؤشرات الأداء',
  File: 'الملف',
  Type: 'النوع',
  Uploaded: 'تاريخ الرفع',
  Verification: 'الاعتماد',
  'Select client': 'اختر العميل',
  'Select mission': 'اختر المهمة',
  'Select party': 'اختر الطرف',
  'Select role': 'اختر الدور',
  'No contract': 'بدون عقد',
  'No route': 'بدون مسار',
  Unassigned: 'غير مسند',
  'Not assigned': 'غير مسند',
  'In progress': 'قيد التنفيذ',
  'Not calculated': 'غير محسوب',
  'Record deviation': 'تسجيل الانحراف',
  'Record recovery': 'تسجيل العودة',
  'Add requirement': 'إضافة متطلب',
  'Save policy': 'حفظ السياسة',
  'Required documents': 'المستندات المطلوبة',
  'Operational closure': 'الإغلاق التشغيلي',
  'Accounting readiness': 'الجاهزية المحاسبية',
  'No document gate': 'لا توجد بوابة مستندات',
  DRAFT: 'مسودة',
  ACTIVE: 'نشط',
  INACTIVE: 'غير نشط',
  ARCHIVED: 'مؤرشف',
  OPEN: 'مفتوح',
  RESOLVED: 'مغلق',
  PENDING: 'قيد الانتظار',
  VERIFIED: 'معتمد',
  REJECTED: 'مرفوض',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغى',
  CRITICAL: 'حرج',
  HIGH: 'عالٍ',
  WARNING: 'تحذير',
  INFO: 'معلومة',
  'Live API data': 'بيانات مباشرة من النظام',
  'Refresh now': 'تحديث الآن',
  'Refreshing…': 'جارٍ التحديث…',
  'Try again': 'إعادة المحاولة',
  'Mission status summary': 'ملخص حالات المهام',
  'Active missions': 'المهام النشطة',
  'Waiting for vehicle': 'في انتظار المركبة',
  Loading: 'قيد التحميل',
  'In transit': 'قيد النقل',
  Delivered: 'تم التسليم',
  'Open exceptions': 'الاستثناءات المفتوحة',
  'Critical exceptions': 'الاستثناءات الحرجة',
  'Active operations': 'العمليات النشطة',
  'Search missions': 'البحث في المهام',
  'Search mission or cargo': 'ابحث برقم المهمة أو نوع الحمولة',
  'Mission status': 'حالة المهمة',
  'All active statuses': 'جميع الحالات النشطة',
  'All clients': 'جميع العملاء',
  'All warehouses': 'جميع المستودعات',
  'All carriers': 'جميع شركات النقل',
  Operation: 'العملية',
  Assignment: 'التكليف',
  Stops: 'المحطات',
  Draft: 'مسودة',
  Assigned: 'مُسندة',
  'Vehicle arrived': 'وصلت المركبة',
  Loaded: 'تم التحميل',
  Departed: 'غادرت',
  'At stop': 'في المحطة',
  Delivering: 'جارٍ التسليم',
  'Operationally closed': 'مغلقة تشغيليًا',
  'Accounting ready': 'جاهزة للمحاسبة',
  Closed: 'مغلقة',
  Cancelled: 'ملغاة',
  'Cargo not specified': 'الحمولة غير محددة',
  'No vehicle': 'لا توجد مركبة',
  'No driver': 'لا يوجد سائق',
  Ready: 'جاهز',
  'Policy not configured': 'السياسة غير مهيأة',
  'View details': 'عرض التفاصيل',
  Overview: 'نظرة عامة',
  'Operational contract': 'العقد التشغيلي',
  'Vehicle / driver': 'المركبة / السائق',
  'Scheduled loading': 'موعد التحميل المخطط',
  'Actual departure': 'المغادرة الفعلية',
  Cargo: 'الحمولة',
  'Not specified': 'غير محدد',
  Notes: 'ملاحظات',
  Expected: 'متوقع',
  'Event timeline': 'التسلسل الزمني للأحداث',
  'Downloading…': 'جارٍ التنزيل…',
  Email: 'البريد الإلكتروني',
  Password: 'كلمة المرور',
  Description: 'الوصف',
  Severity: 'الخطورة',
  Owner: 'المسؤول',
  Date: 'التاريخ',
  Action: 'الإجراء',
  Actor: 'المنفّذ',
  Entity: 'الكيان',
  Request: 'الطلب',
  Change: 'التغيير',
  Time: 'الوقت',
  Region: 'المنطقة',
  'Time zone': 'المنطقة الزمنية',
  Requirements: 'المتطلبات',
  Stage: 'المرحلة',
  Parties: 'الأطراف',
  Cadence: 'الدورية',
  'Effective period': 'فترة السريان',
  'Last login': 'آخر تسجيل دخول',
  'Role assignment': 'إسناد الدور',
  User: 'المستخدم',
  'OPERATIONS OVERVIEW': 'نظرة عامة على العمليات',
  'Current mission states and closure readiness': 'حالات المهام الحالية والجاهزية للإغلاق',
  'Control Tower': 'برج المراقبة',
  'Control Tower unavailable': 'برج المراقبة غير متاح',
  'No active missions found': 'لا توجد مهام نشطة',
  'Automatic refresh interval': 'فاصل التحديث التلقائي',
  'Not at closure stage': 'لم تصل إلى مرحلة الإغلاق',
  'Mission details unavailable': 'تفاصيل المهمة غير متاحة',
  'MISSION OPERATIONS': 'عمليات المهمة',
  'Mission workflow': 'سير عمل المهمة',
  'Server validated': 'معتمد من الخادم',
  'Route deviation': 'انحراف المسار',
  'Status transition': 'تغيير الحالة',
  'Add stop': 'إضافة محطة',
  'Related exceptions': 'الاستثناءات ذات الصلة',
  'Select carrier': 'اختر شركة النقل',
  'Select vehicle': 'اختر المركبة',
  'Select driver': 'اختر السائق',
  'Select warehouse': 'اختر المستودع',
  'Select branch': 'اختر الفرع',
  'All statuses': 'جميع الحالات',
  'Not scheduled': 'غير مجدولة',
  'Closure policies': 'سياسات الإغلاق',
  'Roles & permissions': 'الأدوار والصلاحيات',
  'Rule configuration': 'إعداد القواعد',
  'Customer portal': 'بوابة العميل',
  'Driver portal': 'بوابة السائق',
  OPERATIONS: 'العمليات',
  COMPLIANCE: 'الامتثال',
  EVIDENCE: 'الأدلة',
  GOVERNANCE: 'الحوكمة',
  'NETWORK DESIGN': 'تصميم الشبكة',
  'RULE GOVERNANCE': 'حوكمة القواعد',
  'KPI GOVERNANCE': 'حوكمة مؤشرات الأداء',
  'ACCESS MANAGEMENT': 'إدارة الوصول',
  'COMMERCIAL OPERATIONS': 'العمليات التجارية',
  'OPERATIONAL ALERTS': 'التنبيهات التشغيلية',
  'OPERATIONAL INTELLIGENCE': 'الذكاء التشغيلي',
  'Audit timeline': 'التسلسل الزمني للتدقيق',
  'Loading audit history…': 'جارٍ تحميل سجل التدقيق…',
  'No audit records found for this context.': 'لا توجد سجلات تدقيق لهذا السياق.',
  'Client route definitions with deterministic branch sequences':
    'تعريفات مسارات العملاء مع ترتيب محدد للفروع',
  'Create route': 'إنشاء مسار',
  'Select branches in delivery order': 'اختر الفروع حسب ترتيب التسليم',
  'Route registry': 'سجل المسارات',
  'Configure policy': 'إعداد السياسة',
  'Active policies must be deactivated before replacement':
    'يجب تعطيل السياسات النشطة قبل استبدالها',
  'Each stop': 'كل محطة',
  'Policy registry': 'سجل السياسات',
  'No closure policies configured.': 'لا توجد سياسات إغلاق مهيأة.',
  'Saved directly to the tenant registry': 'يُحفظ مباشرةً في سجل المؤسسة',
  'No records match the current filters.': 'لا توجد سجلات تطابق عوامل التصفية الحالية.',
  'Create immutable, effective-dated tenant rule versions.':
    'أنشئ إصدارات قواعد ثابتة ومؤرخة السريان للمؤسسة.',
  'Rule and scope': 'القاعدة والنطاق',
  'Organization default': 'الإعداد الافتراضي للمؤسسة',
  Organization: 'المؤسسة',
  Condition: 'الشرط',
  Unspecified: 'غير محدد',
  'Responsibility and time': 'المسؤولية والوقت',
  'For example: Asia/Muscat': 'مثال: Asia/Muscat',
  'Version history': 'سجل الإصدارات',
  'Manual reevaluation': 'إعادة التقييم اليدوي',
  'Optional when a window is supplied': 'اختياري عند تحديد فترة زمنية',
  Period: 'الفترة',
  Policy: 'السياسة',
  'Immutable tenant activity recorded by backend workflows':
    'نشاط المؤسسة الثابت والمسجل بواسطة إجراءات النظام',
  'Recent activity': 'النشاط الأخير',
  'Newest entries first': 'الأحدث أولاً',
  Inspect: 'عرض',
  'In-app visibility for rule-generated operational conditions.':
    'عرض داخل النظام للحالات التشغيلية الناتجة عن القواعد.',
  'Unread tenant alerts': 'تنبيهات المؤسسة غير المقروءة',
  Read: 'مقروء',
  'No matching alerts': 'لا توجد تنبيهات مطابقة',
  'Effective service agreements and operational parties':
    'اتفاقيات الخدمة السارية والأطراف التشغيلية',
  'Create contract': 'إنشاء عقد',
  'Effective-to is exclusive in backend validation':
    'تاريخ نهاية السريان غير مشمول وفق تحقق النظام',
  DAILY: 'يومي',
  WEEKLY: 'أسبوعي',
  MONTHLY: 'شهري',
  ANNUAL: 'سنوي',
  EXPIRED: 'منتهي',
  'Contract registry': 'سجل العقود',
  'Tenant identities, account status, and organization roles':
    'هويات المؤسسة وحالات الحسابات وأدوار المؤسسة',
  'Create user': 'إنشاء مستخدم',
  'Creates a real tenant identity': 'ينشئ هوية فعلية في المؤسسة',
  'User registry': 'سجل المستخدمين',
  'Driver identity': 'هوية السائق',
  'Mission evidence, verification, and secure downloads':
    'أدلة المهام والاعتماد والتنزيل الآمن',
  'Upload evidence': 'رفع دليل',
  'PDF, JPEG, or PNG linked to a tenant mission':
    'ملف PDF أو JPEG أو PNG مرتبط بمهمة في المؤسسة',
  'Mission-level': 'على مستوى المهمة',
  'Document registry': 'سجل المستندات',
  'No documents match this filter.': 'لا توجد مستندات تطابق عامل التصفية.',
  'Tenant missions, assignments, stops, events, and closure evidence':
    'مهام المؤسسة والتكليفات والمحطات والأحداث وأدلة الإغلاق',
  'Mission registry': 'سجل المهام',
  'Mission number or cargo': 'رقم المهمة أو الحمولة',
  'Missions unavailable': 'المهام غير متاحة',
  'Client & warehouse': 'العميل والمستودع',
  'No missions match the current filters.': 'لا توجد مهام تطابق عوامل التصفية الحالية.',
  'All relationships are validated by the backend': 'يتحقق النظام من جميع العلاقات',
  'Create mission': 'إنشاء مهمة',
  'Exception workspace': 'مساحة عمل الاستثناءات',
  'Trace the rule, operational facts, responsibility, decision, and action.':
    'تتبّع القاعدة والحقائق التشغيلية والمسؤولية والقرار والإجراء.',
  'Exception status': 'حالة الاستثناء',
  Open: 'مفتوح',
  Resolved: 'مغلق',
  'Exception severity': 'خطورة الاستثناء',
  'All severities': 'جميع درجات الخطورة',
  'No matching exceptions.': 'لا توجد استثناءات مطابقة.',
  'Select an exception to inspect it.': 'اختر استثناءً لعرض تفاصيله.',
  'Exception facts': 'حقائق الاستثناء',
  'Assign owner': 'إسناد المسؤول',
  'Owner user': 'المستخدم المسؤول',
  'Set severity': 'تحديد الخطورة',
  'Root cause': 'السبب الجذري',
  'Observed cause and supporting context': 'السبب الملحوظ والسياق الداعم',
  Decision: 'القرار',
  'Decision and rationale': 'القرار ومبرراته',
  'Supporting evidence': 'الأدلة الداعمة',
  'Evidence purpose (optional)': 'غرض الدليل (اختياري)',
  Resolve: 'إغلاق',
  'Resolution evidence and outcome': 'دليل الإغلاق والنتيجة',
  'Traceability': 'إمكانية التتبع',
  'Root causes': 'الأسباب الجذرية',
  Evidence: 'الأدلة',
  'Decisions and actions': 'القرارات والإجراءات',
  'Add corrective action': 'إضافة إجراء تصحيحي',
  'Corrective action': 'الإجراء التصحيحي',
  'Real backend roles and grant definitions': 'أدوار النظام الفعلية وتعريفات الصلاحيات',
  'Create role': 'إنشاء دور',
  'Select the exact backend permissions granted by this role':
    'اختر صلاحيات النظام الدقيقة الممنوحة لهذا الدور',
  'Role registry': 'سجل الأدوار',
  'Open one active route-deviation incident for this mission.':
    'افتح حادثة انحراف مسار نشطة واحدة لهذه المهمة.',
  'Edit mission': 'تعديل المهمة',
  'Required when cancelling': 'مطلوب عند الإلغاء',
  'No further transitions are available.': 'لا توجد انتقالات أخرى متاحة.',
  'No related exceptions.': 'لا توجد استثناءات ذات صلة.',
  'Edit stop / reorder': 'تعديل المحطة / إعادة الترتيب',
  'Save stop': 'حفظ المحطة',
  'Complete stop': 'إكمال المحطة',
  'KPI definition registry': 'سجل تعريفات مؤشرات الأداء',
  'Version KPI contracts without producing unapproved operational values.':
    'إدارة إصدارات عقود مؤشرات الأداء دون إنتاج قيم تشغيلية غير معتمدة.',
  'Calculation disabled': 'الحساب معطل',
  'No KPI engine, aggregate, score, or historical backfill is active.':
    'لا يوجد محرك مؤشرات أو تجميع أو تقييم أو تعبئة تاريخية نشطة.',
  'Identity and scope': 'الهوية والنطاق',
  'Definition contract': 'عقد التعريف',
  'Calculation governance': 'حوكمة الحساب',
  'Requires approved terminology': 'يتطلب مصطلحات معتمدة',
  Daily: 'يومي',
  'KPI contract history': 'سجل عقود مؤشرات الأداء',
  Enabled: 'مفعّل',
  Values: 'القيم',
  'No KPI contracts exist.': 'لا توجد عقود لمؤشرات الأداء.',
  'Close mission details': 'إغلاق تفاصيل المهمة',
  'No stops have been added.': 'لم تُضف أي محطات.',
  'No documents uploaded for this mission.': 'لم تُرفع مستندات لهذه المهمة.',
  'No mission events recorded.': 'لا توجد أحداث مسجلة للمهمة.',
  'TENANT MASTER DATA': 'البيانات الرئيسية للمؤسسة',
  'TRANSPORT NETWORK': 'شبكة النقل',
  'FLEET OPERATIONS': 'عمليات الأسطول',
  'Client warehouse locations and operating status': 'مواقع مستودعات العملاء وحالتها التشغيلية',
  'Client delivery branches and destinations': 'فروع التسليم ووجهات العملاء',
  'Transport partners available to tenant missions': 'شركاء النقل المتاحون لمهام المؤسسة',
  'Carrier drivers and license details': 'سائقو شركة النقل وتفاصيل الرخص',
  'Tracking number': 'رقم التتبع',
  'Carrier vehicles, types, and capacity': 'مركبات شركة النقل وأنواعها وسعاتها',
  'Warehouse code': 'رمز المستودع',
  'Warehouse name': 'اسم المستودع',
  'Branch code': 'رمز الفرع',
  'Branch name': 'اسم الفرع',
  'Carrier code': 'رمز شركة النقل',
  'Carrier name': 'اسم شركة النقل',
  'Driver name': 'اسم السائق',
  'Saudi region': 'المنطقة السعودية',
  Governorate: 'المحافظة',
  Address: 'العنوان',
  Latitude: 'خط العرض',
  Longitude: 'خط الطول',
  Phone: 'الهاتف',
  'License number': 'رقم الرخصة',
  License: 'الرخصة',
  'Plate number': 'رقم اللوحة',
  Plate: 'اللوحة',
  'Vehicle type': 'نوع المركبة',
  Capacity: 'السعة',
  'Capacity unit': 'وحدة السعة',
  'WAITING FOR VEHICLE': 'في انتظار المركبة',
  'VEHICLE ARRIVED': 'وصلت المركبة',
  'IN TRANSIT': 'قيد النقل',
  'AT STOP': 'في المحطة',
  'OPERATIONALLY CLOSED': 'مغلقة تشغيليًا',
  'ACCOUNTING READY': 'جاهزة للمحاسبة',
  'ARRIVED': 'وصلت',
  'UNLOADING': 'جارٍ التفريغ',
  'UNRATED': 'غير مصنف',
  'Loading delay': 'تأخير التحميل',
  'Departure delay': 'تأخير المغادرة',
  'Stop arrival delay': 'تأخير الوصول إلى المحطة',
  Shortage: 'عجز الكمية',
  Rejection: 'رفض الحمولة',
  Documentation: 'المستندات',
  Accident: 'حادث',
  'WAYBILL': 'بوليصة الشحن',
  'GATE PASS': 'تصريح البوابة',
  POD: 'إثبات التسليم',
  'SHORTAGE PROOF': 'إثبات العجز',
  'RETURN PROOF': 'إثبات الإرجاع',
  OTHER: 'أخرى',
  'MISSION CREATED': 'إنشاء المهمة',
  'MISSION UPDATED': 'تحديث المهمة',
  'MISSION ASSIGNMENT CHANGED': 'تغيير تكليف المهمة',
  'MISSION STATUS CHANGED': 'تغيير حالة المهمة',
  'MISSION STOP ADDED': 'إضافة محطة للمهمة',
  'MISSION STOP UPDATED': 'تحديث محطة المهمة',
  'MISSION STOP ARRIVED': 'وصول المهمة إلى المحطة',
  'MISSION STOP UNLOADING STARTED': 'بدء التفريغ في المحطة',
  'MISSION STOP COMPLETED': 'إكمال محطة المهمة',
  'MISSION ROUTE DEVIATION DETECTED': 'اكتشاف انحراف مسار المهمة',
  'MISSION ROUTE DEVIATION RECOVERED': 'معالجة انحراف مسار المهمة',
  Resolution: 'الإغلاق',
  'Resolution:': 'الإغلاق:',
  'Email delivery': 'التسليم عبر البريد الإلكتروني',
  'Unread only': 'غير المقروءة فقط',
  'Saving…': 'جارٍ الحفظ…',
  'Mark read': 'تحديد كمقروء',
  'Open exception': 'فتح الاستثناء',
  'All caught up.': 'لا توجد تنبيهات جديدة.',
  'No alerts have been generated.': 'لم يتم إنشاء أي تنبيهات.',
  'Retry due': 'موعد إعادة المحاولة',
  'Escalated to': 'تم التصعيد إلى',
  'Escalation due': 'موعد التصعيد',
  'Fleet Manager': 'مدير الأسطول',
  UNSET: 'غير محدد',
  QUEUED: 'في قائمة الانتظار',
  SENT: 'تم الإرسال',
  FAILED: 'فشل',
  EMAIL: 'البريد الإلكتروني',
  Rule: 'القاعدة',
  Scope: 'النطاق',
  'Scope type': 'نوع النطاق',
  'Route and driver SLA scopes remain unavailable under the approved rules.':
    'نطاقات اتفاقية مستوى الخدمة للمسار والسائق غير متاحة ضمن القواعد المعتمدة.',
  'Quantity tolerance': 'هامش الكمية',
  'No product default': 'لا توجد قيمة افتراضية للمنتج',
  'Threshold in minutes': 'الحد بالدقائق',
  'Required to activate time evaluation': 'مطلوب لتفعيل التقييم الزمني',
  Priority: 'الأولوية',
  'Enabled for this scope': 'مفعّل لهذا النطاق',
  'Blocking configuration': 'إعداد حاظر',
  'A blocking flag is recorded, but no mission transition is blocked until a transition-specific policy is approved.':
    'يُسجل مؤشر الحظر، ولكن لن يُحظر أي انتقال للمهمة حتى اعتماد سياسة خاصة بالانتقال.',
  'Default owner': 'المسؤول الافتراضي',
  'IANA time zone': 'المنطقة الزمنية وفق IANA',
  'Working-calendar metadata (JSON)': 'بيانات تقويم العمل (JSON)',
  'Calendar metadata is stored and versioned. It does not alter elapsed time until its business schema is approved.':
    'تُحفظ بيانات التقويم ضمن الإصدارات، ولا تغيّر الوقت المنقضي حتى اعتماد مخطط العمل.',
  'Effective from': 'ساري من',
  'Effective to': 'ساري حتى',
  'Periods cannot overlap for the same rule and scope. New versions do not trigger retroactive evaluation.':
    'لا يمكن أن تتداخل الفترات للقاعدة والنطاق نفسيهما، ولا تؤدي الإصدارات الجديدة إلى تقييم بأثر رجعي.',
  'Create rule version': 'إنشاء إصدار القاعدة',
  'Provide an explicit evaluation time and either one mission or a bounded schedule window.':
    'حدد وقت التقييم ومهمة واحدة أو فترة زمنية محددة للجدول.',
  'Evaluation at': 'وقت التقييم',
  'Mission UUID': 'معرّف المهمة',
  'Scheduled from': 'مجدولة من',
  'Scheduled to': 'مجدولة حتى',
  'Maximum missions': 'الحد الأقصى للمهام',
  'Run reevaluation': 'تشغيل إعادة التقييم',
  'Open-ended': 'مفتوحة النهاية',
  'Definition default / no value': 'القيمة الافتراضية للتعريف / بلا قيمة',
  Disabled: 'معطل',
  'Severity unset': 'الخطورة غير محددة',
  'Blocking flag': 'مؤشر حظر',
  'No scoped versions exist. Product definitions remain in effect.':
    'لا توجد إصدارات محددة النطاق، وتظل تعريفات المنتج سارية.',
  'A new immutable rule version was created and audited.':
    'تم إنشاء إصدار ثابت جديد للقاعدة وتسجيله في سجل التدقيق.',
  'Working-calendar metadata must be a JSON object':
    'يجب أن تكون بيانات تقويم العمل كائن JSON.',
  'Actual loading exceeds scheduled loading by the effective threshold.':
    'يتجاوز التحميل الفعلي موعد التحميل المخطط بالحد الساري.',
  'Actual departure exceeds scheduled departure by the effective threshold.':
    'تتجاوز المغادرة الفعلية موعد المغادرة المخطط بالحد الساري.',
  'Actual stop arrival exceeds expected arrival by the effective threshold.':
    'يتجاوز الوصول الفعلي للمحطة الموعد المتوقع بالحد الساري.',
  'Persisted shortage quantity exceeds the effective tolerance.':
    'تتجاوز كمية العجز المسجلة هامش السماح الساري.',
  'Persisted rejected quantity exceeds the effective tolerance.':
    'تتجاوز الكمية المرفوضة المسجلة هامش السماح الساري.',
  'Formula contract': 'عقد المعادلة',
  'Eligibility contract': 'عقد الأهلية',
  'Data sources': 'مصادر البيانات',
  'Period definition': 'تعريف الفترة',
  'Thresholds and targets': 'الحدود والأهداف',
  'Route scope remains unavailable until a validated KPI route model exists.':
    'يظل نطاق المسار غير متاح حتى وجود نموذج مسار معتمد لمؤشرات الأداء.',
  'Empty fields mean the contract is incomplete; the system does not infer values.':
    'تعني الحقول الفارغة أن العقد غير مكتمل، ولا يستنتج النظام أي قيم.',
  'Rounding mode': 'طريقة التقريب',
  'Decimal scale': 'المنازل العشرية',
  'Target percent': 'النسبة المستهدفة',
  'Calculation frequency': 'دورية الحساب',
  'Contract enabled': 'العقد مفعّل',
  'Enabled records are configuration only. They do not activate calculation.':
    'السجلات المفعّلة هي إعدادات فقط ولا تؤدي إلى تفعيل الحساب.',
  'Periods cannot overlap for the same KPI and scope. New versions do not backfill history.':
    'لا يمكن أن تتداخل الفترات للمؤشر والنطاق نفسيهما، ولا تعبئ الإصدارات الجديدة السجل التاريخي.',
  'Save KPI contract version': 'حفظ إصدار عقد مؤشر الأداء',
  'KPI contract version saved and audited. No KPI value was calculated.':
    'تم حفظ إصدار عقد مؤشر الأداء وتسجيله في سجل التدقيق، ولم تُحسب أي قيمة.',
  'Configuration enabled': 'الإعداد مفعّل',
  'Draft/disabled': 'مسودة / معطل',
  'On-Time Vehicle Arrival': 'وصول المركبة في الموعد',
  'On-Time Loading': 'التحميل في الموعد',
  'On-Time Departure': 'المغادرة في الموعد',
  'On-Time Delivery': 'التسليم في الموعد',
  'POD Completion': 'اكتمال إثبات التسليم',
  'Shortage Rate': 'معدل العجز',
  'Exception Rate': 'معدل الاستثناءات',
  'Carrier Service Level': 'مستوى خدمة شركة النقل',
  'Candidate KPI requiring an approved eligibility and timing contract.':
    'مؤشر أداء مرشح يتطلب عقد أهلية وتوقيت معتمدًا.',
  'Candidate KPI requiring an approved stop/mission aggregation contract.':
    'مؤشر أداء مرشح يتطلب عقد تجميع معتمدًا للمحطات والمهام.',
  'Candidate KPI requiring approved document validity and denominator rules.':
    'مؤشر أداء مرشح يتطلب قواعد معتمدة لصلاحية المستندات والمقام.',
  'Candidate KPI requiring approved units, weighting, and tolerance rules.':
    'مؤشر أداء مرشح يتطلب قواعد معتمدة للوحدات والأوزان وهوامش السماح.',
  'Candidate KPI requiring approved qualifying-exception and eligibility rules.':
    'مؤشر أداء مرشح يتطلب قواعد معتمدة للاستثناءات المؤهلة والأهلية.',
  'Candidate composite KPI requiring approved components and weights.':
    'مؤشر أداء مركب مرشح يتطلب مكونات وأوزانًا معتمدة.',
};

const arabicCaseInsensitive = new Map(
  Object.entries(arabic).map(([source, translation]) => [source.toLocaleLowerCase('en'), translation]),
);

export function translateVisibleText(value: string, locale: 'en' | 'ar-SA') {
  if (locale === 'en') return value;
  const trimmed = value.trim();
  const direct = arabic[trimmed] ?? arabicCaseInsensitive.get(trimmed.toLocaleLowerCase('en'));
  if (direct) return value.replace(trimmed, direct);
  const nouns: Record<string, string> = {
    warehouse: 'مستودع', warehouses: 'المستودعات', branch: 'فرع', branches: 'الفروع',
    carrier: 'شركة نقل', carriers: 'شركات النقل', driver: 'سائق', drivers: 'السائقين',
    vehicle: 'مركبة', vehicles: 'المركبات', mission: 'مهمة', missions: 'المهام',
    client: 'عميل', clients: 'العملاء', role: 'دور', roles: 'الأدوار',
  };
  return value
    .replace(/^Email delivery · /, 'التسليم عبر البريد الإلكتروني · ')
    .replace(/^(\d+)\/2 attempts$/, '$1/2 محاولة')
    .replace(/^Retry due /, 'موعد إعادة المحاولة ')
    .replace(/^Escalated to /, 'تم التصعيد إلى ')
    .replace(/^Escalation due /, 'موعد التصعيد ')
    .replace(/^Product default: (.+)$/, 'القيمة الافتراضية للمنتج: $1')
    .replace(/^(\d+) tenant configuration versions$/, '$1 إصدار لإعدادات المؤسسة')
    .replace(/^(\d+) missions reviewed · (\d+) due time rules evaluated · (\d+) future operations skipped$/,
      '$1 مهمة تمت مراجعتها · $2 قاعدة زمنية مستحقة تم تقييمها · $3 عملية مستقبلية تم تجاوزها')
    .replace(/^(\d+) minutes$/, '$1 دقيقة')
    .replace(/^Tolerance (.+)$/, 'هامش السماح $1')
    .replace(/^(\d+) tenant versions · zero calculated values$/, '$1 إصدار للمؤسسة · صفر قيم محسوبة')
    .replace(/^(\d+) fields supplied$/, 'تم توفير $1 حقل')
    .replace(/^(.+) must be a JSON object$/, 'يجب أن يكون الحقل كائن JSON')
    .replace(/^Page (\d+) of (\d+)$/, 'الصفحة $1 من $2')
    .replace(/^(\d+) missions match the current view$/, '$1 مهمة تطابق العرض الحالي')
    .replace(/^(\d+) open exceptions?$/, '$1 استثناء مفتوح')
    .replace(/^(\d+) requirements? missing$/, '$1 متطلب مفقود')
    .replace(/^(\d+)\/(\d+) complete$/, '$1/$2 مكتمل')
    .replace(/^Stop (\d+)$/, 'المحطة $1')
    .replace(/^Create (.+)$/, 'إنشاء $1')
    .replace(/^(\d+) records$/, '$1 سجل')
    .replace(/^Search (.+)$/i, (_, noun: string) => `بحث في ${nouns[noun.toLowerCase()] ?? noun}`)
    .replace(/^Select (.+)$/i, (_, noun: string) => `اختر ${nouns[noun.toLowerCase()] ?? noun}`)
    .replace(/^Loading (.+)…$/i, (_, noun: string) => `جارٍ تحميل ${nouns[noun.toLowerCase()] ?? noun}…`)
    .replace(/^Create (.+)$/i, (_, noun: string) => `إنشاء ${nouns[noun.toLowerCase()] ?? noun}`)
    .replace(/^Edit (.+)$/i, (_, noun: string) => `تعديل ${nouns[noun.toLowerCase()] ?? noun}`)
    .replace(/^(.+) registry$/i, (_, noun: string) => `سجل ${nouns[noun.toLowerCase()] ?? noun}`);
}

export function LocalizedSurface({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const originalsRef = useRef(new WeakMap<Node, string>());
  const attributeOriginalsRef = useRef(new WeakMap<Element, Map<string, string>>());

  useEffect(() => {
    const root = surfaceRef.current;
    if (!root) return;
    const attributes = ['placeholder', 'aria-label', 'title', 'alt'];

    const localize = () => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let textNode = walker.nextNode();
      while (textNode) {
        const current = textNode.textContent ?? '';
        const saved = originalsRef.current.get(textNode);
        // React can reuse a text node when async data replaces a loading state.
        // Treat content that is neither the saved source nor its translation as new source text.
        const original =
          saved === undefined ||
          (current !== saved && current !== translateVisibleText(saved, 'ar-SA'))
            ? current
            : saved;
        originalsRef.current.set(textNode, original);
        const translated = translateVisibleText(original, locale);
        if (current !== translated) textNode.textContent = translated;
        textNode = walker.nextNode();
      }

      for (const element of root.querySelectorAll('*')) {
        let originals = attributeOriginalsRef.current.get(element);
        if (!originals) {
          originals = new Map();
          attributeOriginalsRef.current.set(element, originals);
        }
        for (const attribute of attributes) {
          const current = element.getAttribute(attribute);
          if (current === null) continue;
          const saved = originals.get(attribute);
          const original =
            saved === undefined ||
            (current !== saved && current !== translateVisibleText(saved, 'ar-SA'))
              ? current
              : saved;
          originals.set(attribute, original);
          const translated = translateVisibleText(original, locale);
          if (current !== translated) element.setAttribute(attribute, translated);
        }
      }
    };

    localize();
    const observer = new MutationObserver(localize);
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true });
    return () => observer.disconnect();
  }, [locale]);

  return (
    <div ref={surfaceRef} className="localized-surface">
      {children}
    </div>
  );
}
