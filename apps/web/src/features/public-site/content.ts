export type PublicLocale = 'en' | 'ar-SA';
export type PublicPageKey = 'platform' | 'solutions' | 'controlTower' | 'intelligence' | 'its' | 'company';

export type PublicContentCard = { title: string; text: string; items?: string[]; tag?: string };
export type PublicPageContent = {
  eyebrow: string;
  title: string;
  lead: string;
  sections: PublicContentCard[];
  flow?: string[];
};

export const publicContent = {
  en: {
    nav: {
      home: 'Home', platform: 'Platform', solutions: 'Solutions', controlTower: 'Control Tower',
      intelligence: 'Intelligence', its: 'ITS', company: 'Company', login: 'Login', menu: 'Menu', close: 'Close menu',
    },
    common: {
      brandLine: 'Transportation operations, connected.',
      loginTitle: 'Enter WAFI OS',
      loginText: 'Authorized teams can continue to the secure operations platform.',
      illustrative: 'Illustrative product view — no live customer or GPS data',
      explore: 'Explore the platform',
      future: 'Future Vision',
      current: 'Available in WAFI OS',
    },
    home: {
      eyebrow: 'LOGISTICS OPERATING SYSTEM · SAUDI ARABIA',
      title: 'Transportation operations. Connected intelligence.',
      lead: 'WAFI connects missions, fleets, contracts, operational exceptions and performance into one governed transportation operating platform.',
      whatTitle: 'One operating picture, from plan to performance',
      whatText: 'WAFI brings the work of transportation teams into a shared operational system—so execution, attention and accountability stay connected.',
      capabilityTitle: 'The operational core',
      intelligenceTitle: 'Move from monitoring to action',
      intelligenceText: 'Configurable rules turn operational events into traceable exceptions, decisions and corrective actions—with audit context throughout.',
      networkTitle: 'Designed around Saudi transportation geography',
      networkText: 'A geographic foundation spanning all 13 administrative regions supports operational locations today and prepares the platform for future connected transportation layers.',
      securityTitle: 'Enterprise foundations are part of the operating model',
      securityText: 'Tenant isolation, role-based permissions, audit trails and governed operational records are embedded in WAFI OS.',
      process: ['Planning', 'Assignment', 'Execution', 'Monitoring', 'Exception detection', 'Resolution', 'Measurement'],
      capabilities: ['Missions & stops', 'Drivers & vehicles', 'Clients & contracts', 'Routes & locations', 'Exceptions & alerts', 'Documents & audit'],
    },
    pages: {
      platform: {
        eyebrow: 'WAFI OS PLATFORM', title: 'One system for the operating lifecycle',
        lead: 'Interconnected capabilities align planning, field execution, operational control, governance and performance.',
        sections: [
          { title: 'Operations', text: 'Plan and execute transportation work.', items: ['Missions', 'Stops', 'Routes', 'Warehouses', 'Branches'] },
          { title: 'Fleet', text: 'Connect the resources assigned to execution.', items: ['Vehicles', 'Drivers', 'Carriers'] },
          { title: 'Commercial operations', text: 'Keep client and contractual context close to execution.', items: ['Clients', 'Contracts'] },
          { title: 'Operational control', text: 'Surface work that needs attention.', items: ['Control Tower', 'Exceptions', 'Alerts', 'Rules'] },
          { title: 'Governance', text: 'Control access and preserve evidence.', items: ['Documents', 'Users', 'Roles', 'RBAC', 'Audit'] },
          { title: 'Performance', text: 'Structure measurement and operational reporting.', items: ['KPI Registry', 'Reports'] },
        ],
        flow: ['Planning', 'Execution', 'Intelligence', 'Control Tower'],
      },
      solutions: {
        eyebrow: 'OPERATIONAL USE CASES', title: 'A shared operating layer for transportation organizations',
        lead: 'WAFI applies one governed operating model across fleets, transportation, distribution and multi-client logistics.',
        sections: [
          { title: 'Fleet operations', text: 'Coordinate vehicles, drivers, carriers and operational assignments.' },
          { title: 'Transportation operations', text: 'Manage mission execution from planning through controlled completion.' },
          { title: 'Logistics & 3PL', text: 'Coordinate clients, contracts, routes and workflows in one tenant-isolated environment.' },
          { title: 'Distribution operations', text: 'Connect warehouses, branches, stops and delivery missions.' },
          { title: 'Industrial logistics', text: 'Support structured execution with documents, permissions and auditability.' },
          { title: 'Operational control', text: 'Centralize visibility, exception handling and team attention.' },
        ],
      },
      controlTower: {
        eyebrow: 'INTELLIGENT CONTROL TOWER', title: 'See the operation. Focus the response.',
        lead: 'A Saudi-centered operational view brings missions, locations, routes and exceptions into one attention-driven workspace.',
        sections: [
          { title: 'Where are operations happening?', text: 'A geographic view organizes known mission and business locations across the Kingdom.' },
          { title: 'What requires attention?', text: 'Exceptions and alerts bring higher-priority operational conditions into focus.' },
          { title: 'What should the team investigate?', text: 'Mission context, status and traceable exception workflows support informed follow-up.' },
        ],
        flow: ['Locations', 'Missions', 'Operational status', 'Exceptions', 'Team attention'],
      },
      intelligence: {
        eyebrow: 'OPERATIONAL INTELLIGENCE', title: 'Turn operational events into governed action',
        lead: 'WAFI connects configurable rules, exception workflows and audit context—moving teams beyond passive monitoring.',
        sections: [
          { title: 'Detect', text: 'Approved rule configurations evaluate supported operational conditions.', items: ['Configurable rules', 'Exception detection', 'Bounded reevaluation', 'Severity'] },
          { title: 'Act', text: 'Operators document who owns the issue and what happens next.', items: ['Alerts', 'Assignment', 'Root causes', 'Decisions', 'Corrective actions'] },
          { title: 'Learn', text: 'Resolution and evidence remain traceable for governance and reporting.', items: ['Resolution', 'Audit trail', 'KPI architecture', 'Reports'] },
        ],
        flow: ['Operational event', 'Rules', 'Exception', 'Attention', 'Decision', 'Corrective action', 'Resolution', 'Reporting'],
      },
      its: {
        eyebrow: 'WAFI ITS VISION · FUTURE ROADMAP', title: 'Preparing for connected transportation intelligence',
        lead: 'WAFI’s architecture is evolving toward physical-world transportation signals while keeping future capabilities clearly separate from today’s operational platform.',
        sections: [
          { title: 'Connected vehicle layer', text: 'Future telemetry interfaces for position, speed, heading and vehicle signals.', tag: 'Future Capability' },
          { title: 'Road environment layer', text: 'Future traffic, incident, closure and weather context.', tag: 'Architecture Direction' },
          { title: 'Predictive operations layer', text: 'Future ETA intelligence, route risk, recommendations and smart routing.', tag: 'Future Vision' },
        ],
        flow: ['GPS / telematics', 'Live position', 'Geofencing', 'Road conditions', 'Weather & incidents', 'ETA intelligence', 'Route risk', 'Predictive operations', 'Smart routing', 'Control Tower'],
      },
      company: {
        eyebrow: 'ABOUT WAFI', title: 'Building the operating environment for modern transportation',
        lead: 'WAFI is focused on helping Saudi transportation organizations connect execution, exceptions, accountability and performance.',
        sections: [
          { title: 'Who we are', text: 'WAFI builds technology for modern logistics and transportation operations.' },
          { title: 'Our vision', text: 'A connected transportation operating environment where operational data becomes actionable intelligence.' },
          { title: 'Our mission', text: 'Help transportation teams manage execution, exceptions, accountability and performance through one platform.' },
          { title: 'Saudi focus', text: 'The platform is initially shaped around the geography and operating needs of transportation in Saudi Arabia.' },
        ],
        flow: ['Logistics Operating System', 'Operational Intelligence', 'Connected Transportation', 'Intelligent Transportation Platform'],
      },
    } satisfies Record<PublicPageKey, PublicPageContent>,
  },
  'ar-SA': {
    nav: {
      home: 'الرئيسية', platform: 'المنصة', solutions: 'الحلول', controlTower: 'برج التحكم',
      intelligence: 'الذكاء التشغيلي', its: 'النقل الذكي', company: 'عن وافي', login: 'تسجيل الدخول', menu: 'القائمة', close: 'إغلاق القائمة',
    },
    common: {
      brandLine: 'عمليات النقل، في منظومة مترابطة.',
      loginTitle: 'الدخول إلى WAFI OS',
      loginText: 'يمكن للفرق المصرح لها الانتقال إلى منصة العمليات الآمنة.',
      illustrative: 'عرض توضيحي للمنتج — لا يتضمن بيانات عملاء أو GPS مباشرة',
      explore: 'استكشف المنصة',
      future: 'رؤية مستقبلية',
      current: 'متاح ضمن WAFI OS',
    },
    home: {
      eyebrow: 'نظام تشغيل لوجستي · المملكة العربية السعودية',
      title: 'عمليات النقل. بذكاء مترابط.',
      lead: 'يربط وافي المهام والأسطول والعقود والاستثناءات التشغيلية والأداء ضمن منصة واحدة منضبطة لإدارة النقل.',
      whatTitle: 'صورة تشغيلية واحدة، من التخطيط حتى قياس الأداء',
      whatText: 'يجمع وافي أعمال فرق النقل في نظام تشغيلي مشترك، لتبقى عمليات التنفيذ والمتابعة والمساءلة مترابطة.',
      capabilityTitle: 'الركائز التشغيلية',
      intelligenceTitle: 'من المراقبة إلى الإجراء',
      intelligenceText: 'تحوّل القواعد القابلة للتهيئة الأحداث التشغيلية إلى استثناءات وقرارات وإجراءات تصحيحية قابلة للتتبع، ضمن سياق تدقيقي متكامل.',
      networkTitle: 'مصمم حول جغرافية النقل السعودية',
      networkText: 'توفر قاعدة جغرافية تشمل المناطق الإدارية الثلاث عشرة مرجعًا للمواقع التشغيلية اليوم، وتمهّد لطبقات النقل المتصل مستقبلًا.',
      securityTitle: 'أسس مؤسسية ضمن نموذج التشغيل',
      securityText: 'عزل المستأجرين والصلاحيات حسب الأدوار وسجلات التدقيق والبيانات التشغيلية المنضبطة مكونات أصيلة في WAFI OS.',
      process: ['التخطيط', 'الإسناد', 'التنفيذ', 'المراقبة', 'اكتشاف الاستثناء', 'المعالجة', 'القياس'],
      capabilities: ['المهام والمحطات', 'السائقون والمركبات', 'العملاء والعقود', 'المسارات والمواقع', 'الاستثناءات والتنبيهات', 'المستندات والتدقيق'],
    },
    pages: {
      platform: {
        eyebrow: 'منصة WAFI OS', title: 'نظام واحد يغطي دورة التشغيل',
        lead: 'قدرات مترابطة توحّد التخطيط والتنفيذ الميداني والرقابة التشغيلية والحوكمة وقياس الأداء.',
        sections: [
          { title: 'العمليات', text: 'تخطيط أعمال النقل وتنفيذها.', items: ['المهام', 'المحطات', 'المسارات', 'المستودعات', 'الفروع'] },
          { title: 'الأسطول', text: 'ربط الموارد المسندة للتنفيذ.', items: ['المركبات', 'السائقون', 'شركات النقل'] },
          { title: 'العمليات التجارية', text: 'ربط سياق العميل والعقد بالتنفيذ.', items: ['العملاء', 'العقود'] },
          { title: 'الرقابة التشغيلية', text: 'إبراز الأعمال التي تحتاج إلى متابعة.', items: ['برج التحكم', 'الاستثناءات', 'التنبيهات', 'القواعد'] },
          { title: 'الحوكمة', text: 'ضبط الوصول وحفظ الأدلة.', items: ['المستندات', 'المستخدمون', 'الأدوار', 'الصلاحيات', 'التدقيق'] },
          { title: 'الأداء', text: 'تنظيم القياس والتقارير التشغيلية.', items: ['سجل مؤشرات الأداء', 'التقارير'] },
        ], flow: ['التخطيط', 'التنفيذ', 'الذكاء التشغيلي', 'برج التحكم'],
      },
      solutions: {
        eyebrow: 'حالات الاستخدام التشغيلية', title: 'طبقة تشغيل مشتركة لمنظمات النقل',
        lead: 'يطبق وافي نموذجًا تشغيليًا منضبطًا على الأساطيل والنقل والتوزيع والخدمات اللوجستية متعددة العملاء.',
        sections: [
          { title: 'تشغيل الأسطول', text: 'تنسيق المركبات والسائقين وشركات النقل وعمليات الإسناد.' },
          { title: 'عمليات النقل', text: 'إدارة تنفيذ المهمة من التخطيط حتى الإكمال المنضبط.' },
          { title: 'الخدمات اللوجستية و3PL', text: 'تنسيق العملاء والعقود والمسارات وسير العمل ضمن بيئة معزولة لكل منشأة.' },
          { title: 'عمليات التوزيع', text: 'ربط المستودعات والفروع والمحطات ومهام التسليم.' },
          { title: 'اللوجستيات الصناعية', text: 'دعم التنفيذ المنظم بالمستندات والصلاحيات وقابلية التدقيق.' },
          { title: 'الرقابة التشغيلية', text: 'توحيد الرؤية وإدارة الاستثناءات وتركيز انتباه الفريق.' },
        ],
      },
      controlTower: {
        eyebrow: 'برج التحكم الذكي', title: 'شاهد العملية. وركّز الاستجابة.',
        lead: 'رؤية تشغيلية تتمحور حول المملكة وتجمع المهام والمواقع والمسارات والاستثناءات في مساحة عمل تقودها الأولويات.',
        sections: [
          { title: 'أين تجري العمليات؟', text: 'ينظم العرض الجغرافي مواقع المهام والمنشآت المعروفة عبر المملكة.' },
          { title: 'ما الذي يحتاج إلى انتباه؟', text: 'تبرز الاستثناءات والتنبيهات الحالات التشغيلية الأعلى أولوية.' },
          { title: 'ما الذي ينبغي للفريق التحقق منه؟', text: 'يدعم سياق المهمة وحالتها ومسار معالجة الاستثناء متابعة مدروسة.' },
        ], flow: ['المواقع', 'المهام', 'الحالة التشغيلية', 'الاستثناءات', 'انتباه الفريق'],
      },
      intelligence: {
        eyebrow: 'الذكاء التشغيلي', title: 'حوّل الأحداث التشغيلية إلى إجراء منضبط',
        lead: 'يربط وافي القواعد القابلة للتهيئة بمسارات معالجة الاستثناء وسياق التدقيق، لينتقل الفريق من المراقبة السلبية إلى الفعل.',
        sections: [
          { title: 'الاكتشاف', text: 'تقيّم إعدادات القواعد المعتمدة الحالات التشغيلية المدعومة.', items: ['قواعد قابلة للتهيئة', 'اكتشاف الاستثناء', 'إعادة تقييم محدودة', 'درجة الخطورة'] },
          { title: 'الإجراء', text: 'يوثّق المشغلون المسؤولية والخطوة التالية.', items: ['التنبيهات', 'الإسناد', 'الأسباب الجذرية', 'القرارات', 'الإجراءات التصحيحية'] },
          { title: 'التعلّم', text: 'تبقى المعالجة والأدلة قابلة للتتبع لأغراض الحوكمة والتقارير.', items: ['المعالجة', 'سجل التدقيق', 'معمارية المؤشرات', 'التقارير'] },
        ], flow: ['حدث تشغيلي', 'القواعد', 'استثناء', 'الأولوية', 'قرار', 'إجراء تصحيحي', 'المعالجة', 'التقارير'],
      },
      its: {
        eyebrow: 'رؤية WAFI للنقل الذكي · خارطة طريق مستقبلية', title: 'الاستعداد لذكاء النقل المتصل',
        lead: 'تتجه معمارية وافي نحو ربط إشارات العالم الفعلي للنقل، مع فصل واضح بين قدرات المستقبل والمنصة التشغيلية المتاحة اليوم.',
        sections: [
          { title: 'طبقة المركبة المتصلة', text: 'واجهات مستقبلية للموقع والسرعة والاتجاه وإشارات المركبة.', tag: 'قدرة مستقبلية' },
          { title: 'طبقة بيئة الطريق', text: 'سياق مستقبلي للازدحام والحوادث والإغلاقات والطقس.', tag: 'توجه معماري' },
          { title: 'طبقة العمليات التنبؤية', text: 'ذكاء مستقبلي للوقت المتوقع ومخاطر المسار والتوصيات والتوجيه الذكي.', tag: 'رؤية مستقبلية' },
        ], flow: ['GPS والاتصالات', 'الموقع المباشر', 'السياج الجغرافي', 'حالة الطرق', 'الطقس والحوادث', 'ذكاء ETA', 'مخاطر المسار', 'العمليات التنبؤية', 'التوجيه الذكي', 'برج التحكم'],
      },
      company: {
        eyebrow: 'عن وافي', title: 'نبني بيئة التشغيل الحديثة للنقل',
        lead: 'يركز وافي على مساعدة منظمات النقل السعودية في ربط التنفيذ والاستثناءات والمساءلة والأداء.',
        sections: [
          { title: 'من نحن', text: 'يبني وافي تقنيات للعمليات اللوجستية وعمليات النقل الحديثة.' },
          { title: 'رؤيتنا', text: 'بيئة تشغيل نقل مترابطة تتحول فيها البيانات التشغيلية إلى ذكاء قابل للتنفيذ.' },
          { title: 'مهمتنا', text: 'تمكين فرق النقل من إدارة التنفيذ والاستثناءات والمساءلة والأداء عبر منصة واحدة.' },
          { title: 'تركيز سعودي', text: 'تتشكل المنصة بدايةً حول جغرافية النقل في المملكة واحتياجاته التشغيلية.' },
        ], flow: ['نظام تشغيل لوجستي', 'ذكاء تشغيلي', 'نقل متصل', 'منصة نقل ذكية'],
      },
    } satisfies Record<PublicPageKey, PublicPageContent>,
  },
} as const;

export function getPublicContent(locale: PublicLocale) {
  return publicContent[locale];
}
