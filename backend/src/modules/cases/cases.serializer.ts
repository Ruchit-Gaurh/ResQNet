/**
 * RESQNET — Cases Serializer
 * Role-aware response projection for case data.
 * Filters sensitive information based on caller's role.
 */

export interface SerializedCase {
  caseId: string;
  type: string;
  status: string;
  priority: string;
  person: Record<string, unknown>;
  lastKnownLocation?: Record<string, unknown> | null;
  lastKnownTime?: string | null;
  source: string;
  sourceTrustScore: number;
  verificationState: string;
  createdAt: string;
  updatedAt: string;
  corroborationCount: number;
  evidenceIds: string[];
}

/**
 * Serialize a Prisma Case record with role-aware field filtering.
 *
 * PUBLIC/FAMILY: Hide phone, exact GPS, minor photos, medical, parent names
 * VOLUNTEER: Same as PUBLIC
 * HOSPITAL/RELIEF_CAMP: Full person data + exact coordinates
 * RESPONDER_ADMIN: Everything including all evidence
 */
export function serializeCase(caseRow: any, role: string): SerializedCase {
  const personData = (typeof caseRow.personData === 'string'
    ? JSON.parse(caseRow.personData)
    : caseRow.personData) as Record<string, unknown>;

  const locationData = caseRow.lastKnownLocation
    ? (typeof caseRow.lastKnownLocation === 'string'
      ? JSON.parse(caseRow.lastKnownLocation)
      : caseRow.lastKnownLocation) as Record<string, unknown>
    : null;

  const isPrivileged = ['HOSPITAL', 'RELIEF_CAMP', 'RESPONDER_ADMIN'].includes(role);
  const isAdmin = role === 'RESPONDER_ADMIN';
  const isMinor = personData.isMinor === true;

  // Build person profile based on role
  const person: Record<string, unknown> = {
    name: personData.name,
    nickname: personData.nickname,
    gender: personData.gender,
    clothing: personData.clothing,
    identifyingMarks: personData.identifyingMarks,
    height: personData.height,
    languageSpoken: personData.languageSpoken,
  };

  // Age — always visible
  if (personData.age != null) person.age = personData.age;
  if (personData.approximateAge != null) person.approximateAge = personData.approximateAge;

  // Sensitive fields — only for privileged roles
  if (isPrivileged) {
    person.phoneNumber = personData.phoneNumber;
    person.alternateContact = personData.alternateContact;
    person.fatherMotherName = personData.fatherMotherName;
    person.medicalNeeds = personData.medicalNeeds;
    person.isMinor = personData.isMinor;
    person.photoUrl = personData.photoUrl;
  } else {
    // Public/Family/Volunteer — hide sensitive data
    // Photo hidden for minors in public view
    if (!isMinor) {
      person.photoUrl = personData.photoUrl;
    }
  }

  // Build location based on role
  let location: Record<string, unknown> | null = null;
  if (locationData) {
    if (isPrivileged) {
      // Full location for privileged roles
      location = { ...locationData };
    } else {
      // Zone only for public users — no exact coordinates
      location = {
        zone: locationData.zone || 'Unknown zone',
      };
    }
  }

  // Build evidence IDs
  const evidenceIds: string[] = [];
  if (isAdmin && caseRow.evidenceReports) {
    for (const ev of caseRow.evidenceReports) {
      evidenceIds.push(ev.evidenceId);
    }
  }

  // Remove undefined values from person
  for (const key of Object.keys(person)) {
    if (person[key] === undefined) delete person[key];
  }

  return {
    caseId: caseRow.caseId,
    type: caseRow.type,
    status: caseRow.status,
    priority: caseRow.priority,
    person,
    lastKnownLocation: location,
    lastKnownTime: caseRow.lastKnownTime?.toISOString() ?? null,
    source: caseRow.source,
    sourceTrustScore: caseRow.sourceTrustScore,
    verificationState: caseRow.verificationState,
    createdAt: caseRow.createdAt.toISOString(),
    updatedAt: caseRow.updatedAt.toISOString(),
    corroborationCount: caseRow.corroborationCount || 0,
    evidenceIds,
  };
}
