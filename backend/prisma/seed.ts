import { PrismaClient, CaseType, CaseStatus, PriorityLevel, ReportSource, VerificationState, MatchConfidence, MatchStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting ResQNet database seed...');

  // 1. Clean existing records in reverse dependency order
  await prisma.verification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.matchCandidate.deleteMany();
  await prisma.sighting.deleteMany();
  await prisma.evidenceReport.deleteMany();
  await prisma.syncMessage.deleteMany();
  await prisma.safeCheckIn.deleteMany();
  await prisma.case.deleteMany();

  // 2. Create Cases
  const casesData = [
    {
      caseId: 'CASE-10291',
      type: CaseType.MISSING,
      status: CaseStatus.SEARCHING,
      priority: PriorityLevel.HIGH,
      personName: 'Rahul Sharma',
      personData: {
        name: 'Rahul Sharma',
        nickname: 'Bittu',
        age: 22,
        gender: 'MALE',
        fatherMotherName: 'Ramesh Sharma (Father)',
        phoneNumber: '+91 98765 43210',
        alternateContact: '+91 98111 22334',
        identifyingMarks: 'Small scar above left eyebrow, black birthmark on neck',
        clothing: 'Navy blue round-neck t-shirt, dark denim jeans, grey sneakers',
        medicalNeeds: 'Asthma inhaler required daily',
        isMinor: false,
        photoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80'
      },
      lastKnownLocation: {
        lat: 28.6139,
        lng: 77.2090,
        zone: 'Zone A — Riverfront Flash Flood',
        address: 'Near Old River Bridge, Sector 4'
      },
      lastKnownTime: new Date('2026-09-11T07:45:00Z'),
      source: ReportSource.FAMILY,
      sourceTrustScore: 0.95,
      verificationState: VerificationState.UNDER_REVIEW,
      createdById: 'usr-family-01'
    },
    {
      caseId: 'CASE-10305',
      type: CaseType.UNIDENTIFIED_PATIENT,
      status: CaseStatus.INFORMATION_RECEIVED,
      priority: PriorityLevel.HIGH,
      personName: 'UNKNOWN PERSON (Tag: Rahool S.)',
      personData: {
        name: 'UNKNOWN PERSON (Tag: Rahool S.)',
        approximateAge: 23,
        gender: 'MALE',
        identifyingMarks: 'Laceration scar on left forehead/eyebrow, neck birthmark',
        clothing: 'Blue t-shirt (stained), black trousers',
        medicalNeeds: 'Treated for mild concussion & smoke inhalation. Stable.',
        isMinor: false,
        photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80'
      },
      lastKnownLocation: {
        lat: 28.6195,
        lng: 77.2165,
        zone: 'Zone B — General Trauma Center',
        address: 'Trauma Ward 2, Bed 14'
      },
      lastKnownTime: new Date('2026-09-11T09:10:00Z'),
      source: ReportSource.HOSPITAL,
      sourceTrustScore: 0.98,
      verificationState: VerificationState.UNVERIFIED,
      createdById: 'usr-hospital-01'
    },
    {
      caseId: 'CASE-10292',
      type: CaseType.MISSING,
      status: CaseStatus.SEARCHING,
      priority: PriorityLevel.CRITICAL,
      personName: 'Riya Patel',
      personData: {
        name: 'Riya Patel',
        age: 8,
        gender: 'FEMALE',
        fatherMotherName: 'Pooja Patel',
        clothing: 'Bright yellow raincoat with blue school uniform skirt',
        identifyingMarks: 'Small mole on right cheek',
        isMinor: true,
        photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80'
      },
      lastKnownLocation: {
        lat: 28.6190,
        lng: 77.2130,
        zone: 'Zone B',
        address: 'Near Primary School Bus Stop'
      },
      lastKnownTime: new Date('2026-09-11T08:00:00Z'),
      source: ReportSource.FAMILY,
      sourceTrustScore: 0.92,
      verificationState: VerificationState.UNDER_REVIEW,
      createdById: 'usr-family-02'
    },
    {
      caseId: 'CASE-10293',
      type: CaseType.MISSING,
      status: CaseStatus.SEARCHING,
      priority: PriorityLevel.HIGH,
      personName: 'Vikram Malhotra',
      personData: {
        name: 'Vikram Malhotra',
        age: 67,
        gender: 'MALE',
        clothing: 'White kurta-pyjama, brown cardigan',
        identifyingMarks: 'Spectacles, walking stick, silver wristwatch',
        medicalNeeds: 'Diabetic — requires regular insulin administration',
        isMinor: false,
        photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80'
      },
      lastKnownLocation: {
        lat: 28.6080,
        lng: 77.2210,
        zone: 'Zone C — Industrial Sector 9',
        address: 'Sector 9 Market Gate 2'
      },
      lastKnownTime: new Date('2026-09-11T07:15:00Z'),
      source: ReportSource.FAMILY,
      sourceTrustScore: 0.88,
      verificationState: VerificationState.UNDER_REVIEW,
      createdById: 'usr-family-03'
    },
    {
      caseId: 'CASE-10307',
      type: CaseType.FOUND,
      status: CaseStatus.INFORMATION_RECEIVED,
      priority: PriorityLevel.NORMAL,
      personName: 'Unidentified Elderly Male',
      personData: {
        name: 'Unidentified Elderly Male',
        approximateAge: 68,
        gender: 'MALE',
        clothing: 'White traditional attire, brown cardigan, silver wristwatch',
        medicalNeeds: 'Hypoglycemic shock symptoms, disoriented',
        identifyingMarks: 'Silver watch engraved "V.M.", bifocal glasses',
        isMinor: false,
        photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80'
      },
      lastKnownLocation: {
        lat: 28.6075,
        lng: 77.2270,
        zone: 'Zone C — Industrial Sector 9',
        address: 'Sector 9 Stadium Evacuation Center, Triage Unit'
      },
      lastKnownTime: new Date('2026-09-11T09:40:00Z'),
      source: ReportSource.RELIEF_CAMP,
      sourceTrustScore: 0.90,
      verificationState: VerificationState.UNVERIFIED,
      createdById: 'usr-camp-01'
    },
    {
      caseId: 'CASE-10294',
      type: CaseType.MISSING,
      status: CaseStatus.SEARCHING,
      priority: PriorityLevel.NORMAL,
      personName: 'Sunita Verma',
      personData: {
        name: 'Sunita Verma',
        age: 45,
        gender: 'FEMALE',
        clothing: 'Green printed salwar kameez, red bangles',
        identifyingMarks: 'Gold nose ring',
        isMinor: false,
        photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80'
      },
      lastKnownLocation: {
        lat: 28.6115,
        lng: 77.2060,
        zone: 'Zone A — Riverfront',
        address: 'Near Old Water Tank'
      },
      lastKnownTime: new Date('2026-09-11T07:30:00Z'),
      source: ReportSource.PUBLIC,
      sourceTrustScore: 0.75,
      verificationState: VerificationState.UNVERIFIED,
      createdById: 'usr-public-01'
    }
  ];

  const createdCases: Record<string, string> = {};
  for (const c of casesData) {
    const created = await prisma.case.create({ data: c });
    createdCases[c.caseId] = created.id;
  }
  console.log(`✅ Seeded ${casesData.length} disaster cases`);

  // 3. Evidence Reports
  await prisma.evidenceReport.createMany({
    data: [
      {
        evidenceId: 'EVID-FAM-10291',
        caseId: createdCases['CASE-10291'],
        type: 'PHOTO',
        data: { description: 'Family uploaded portrait photo' },
        source: ReportSource.FAMILY
      },
      {
        evidenceId: 'EVID-HOSP-10305',
        caseId: createdCases['CASE-10305'],
        type: 'HOSPITAL_RECORD',
        data: { description: 'ER intake sheet & trauma ward photo' },
        source: ReportSource.HOSPITAL
      }
    ]
  });

  // 4. Match Candidates
  await prisma.matchCandidate.create({
    data: {
      matchId: 'MATCH-9001',
      targetMissingCaseId: createdCases['CASE-10291'],
      candidateFoundCaseId: createdCases['CASE-10305'],
      overallScore: 91.2,
      confidenceLevel: MatchConfidence.STRONG_CANDIDATE,
      breakdown: {
        nameScore: 94.0,
        ageScore: 95.0,
        locationScore: 92.0,
        timelineScore: 88.0,
        physicalScore: 90.0,
        photoScore: 82.0
      },
      reasons: [
        '✓ High phonetic name similarity: "Rahool Sharma" vs "Rahul Sharma" (RapidFuzz token score: 94%)',
        '✓ Age difference is within 1 year (23 vs 22)',
        '✓ Location proximity: 0.7 km between Zone A riverfront and Zone B General Hospital',
        '✓ Clothing match: Navy blue t-shirt matches hospital intake clothing description',
        '✓ Identifying marks: Facial eyebrow scar & birthmark verified on admission form'
      ],
      warnings: [
        '⚠ Facial photo embedding similarity is 82% — requires mandatory human responder confirmation',
        '⚠ Minor spelling variance recorded at emergency intake desk'
      ],
      status: MatchStatus.PENDING_REVIEW
    }
  });

  await prisma.matchCandidate.create({
    data: {
      matchId: 'MATCH-4822',
      targetMissingCaseId: createdCases['CASE-10293'],
      candidateFoundCaseId: createdCases['CASE-10307'],
      overallScore: 84.8,
      confidenceLevel: MatchConfidence.STRONG_CANDIDATE,
      breakdown: {
        nameScore: 40.0,
        ageScore: 98.0,
        locationScore: 94.0,
        timelineScore: 90.0,
        physicalScore: 96.0,
        photoScore: 78.0
      },
      reasons: [
        '✓ Exact physical match: White kurta with brown cardigan and silver wristwatch',
        '✓ Medical condition correlation: Known diabetic missing person vs disoriented patient in hypoglycemic state',
        '✓ Age match: 67 years reported vs ~68 years estimated by camp doctor',
        '✓ Location proximity: Found 200m from reported Gate 2 location'
      ],
      warnings: [
        '⚠ Name unknown on intake — patient currently disoriented and unable to speak clearly',
        '⚠ Direct family confirmation recommended via video or photograph review'
      ],
      status: MatchStatus.PENDING_REVIEW
    }
  });
  console.log('✅ Seeded 2 match candidates (MATCH-9001, MATCH-4822)');

  // 5. Initial Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        actor: 'DISASTER_MATCH_ENGINE_V1',
        action: 'MATCH_CANDIDATE_GENERATED',
        resource: 'MatchCandidate',
        resourceId: 'MATCH-9001',
        caseId: createdCases['CASE-10291'],
        metadata: {
          matchId: 'MATCH-9001',
          candidateCaseId: 'CASE-10305',
          candidatePersonName: 'UNKNOWN PERSON (Tag: Rahool S.)',
          decision: 'PENDING_REVIEW',
          notes: 'High-confidence AI correlation generated across Zone A & B. Waiting for authorized human verification.'
        }
      },
      {
        actor: 'DISASTER_MATCH_ENGINE_V1',
        action: 'MATCH_CANDIDATE_GENERATED',
        resource: 'MatchCandidate',
        resourceId: 'MATCH-4822',
        caseId: createdCases['CASE-10293'],
        metadata: {
          matchId: 'MATCH-4822',
          candidateCaseId: 'CASE-10307',
          candidatePersonName: 'Unidentified Elderly Male',
          decision: 'PENDING_REVIEW',
          notes: 'Physical traits and medical correlation flagged for clinical verification.'
        }
      }
    ]
  });
  console.log('✅ Seeded audit log events');
  console.log('🎉 Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
