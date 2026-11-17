// Test location data fixtures matching Django serializer format: [{id, name}, ...]

export const counties = [
  { id: 1, name: 'Nairobi' },
  { id: 2, name: 'Mombasa' },
  { id: 3, name: 'Kisumu' },
  { id: 4, name: 'Nakuru' },
  { id: 5, name: 'Eldoret' },
]

export const subCounties = {
  // Keyed by county name (lowercase)
  nairobi: [
    { id: 10, name: 'Westlands' },
    { id: 11, name: 'Dagoretti North' },
    { id: 12, name: 'Dagoretti South' },
    { id: 13, name: 'Langata' },
    { id: 14, name: 'Kibra' },
    { id: 15, name: 'Roysambu' },
    { id: 16, name: 'Kasarani' },
    { id: 17, name: 'Ruaraka' },
    { id: 18, name: 'Embakasi South' },
    { id: 19, name: 'Embakasi North' },
    { id: 20, name: 'Embakasi Central' },
    { id: 21, name: 'Embakasi East' },
    { id: 22, name: 'Embakasi West' },
    { id: 23, name: 'Makadara' },
    { id: 24, name: 'Kamukunji' },
    { id: 25, name: 'Starehe' },
    { id: 26, name: 'Mathare' },
  ],
  mombasa: [
    { id: 30, name: 'Mvita' },
    { id: 31, name: 'Nyali' },
    { id: 32, name: 'Kisauni' },
    { id: 33, name: 'Jomvu' },
    { id: 34, name: 'Changamwe' },
    { id: 35, name: 'Likoni' },
  ],
  kisumu: [
    { id: 40, name: 'Kisumu East' },
    { id: 41, name: 'Kisumu West' },
    { id: 42, name: 'Kisumu Central' },
    { id: 43, name: 'Seme' },
    { id: 44, name: 'Nyando' },
    { id: 45, name: 'Muhoroni' },
    { id: 46, name: 'Nyakach' },
  ],
}

export const wards = {
  // Keyed by "county-subcounty"
  'nairobi-westlands': [
    { id: 100, name: 'Kitisuru' },
    { id: 101, name: 'Parklands/Highridge' },
    { id: 102, name: 'Karura' },
    { id: 103, name: 'Kangemi' },
    { id: 104, name: 'Mountain View' },
  ],
  'nairobi-dagoretti north': [
    { id: 110, name: 'Kilimani' },
    { id: 111, name: 'Kawangware' },
    { id: 112, name: 'Gatina' },
    { id: 113, name: 'Kileleshwa' },
    { id: 114, name: 'Kabiro' },
  ],
  'mombasa-mvita': [
    { id: 200, name: 'Mji Wa Kale/Makadara' },
    { id: 201, name: 'Tudor' },
    { id: 202, name: 'Tononoka' },
    { id: 203, name: 'Shimanzi/Ganjoni' },
    { id: 204, name: 'Majengo' },
  ],
}

export const neighborhoods = {
  // Keyed by "county-subcounty-ward"
  'nairobi-westlands-kitisuru': [
    { id: 1000, name: 'Kitisuru' },
    { id: 1001, name: 'Loresho' },
    { id: 1002, name: 'Kyuna' },
    { id: 1003, name: 'Muthaiga' },
    { id: 1004, name: 'Spring Valley' },
  ],
  'nairobi-westlands-parklands/highridge': [
    { id: 1010, name: 'Parklands' },
    { id: 1011, name: 'Highridge' },
    { id: 1012, name: 'Westlands' },
  ],
  'nairobi-dagoretti north-kilimani': [
    { id: 1100, name: 'Kilimani' },
    { id: 1101, name: 'Yaya Centre' },
    { id: 1102, name: 'Riverside' },
  ],
  'mombasa-mvita-mji wa kale/makadara': [
    { id: 2000, name: 'Old Town' },
    { id: 2001, name: 'Makadara' },
    { id: 2002, name: 'Tudor' },
  ],
}

// Landmarks (streets, schools, health centers, buildings, markets)
export const landmarks = {
  streets: {
    'nairobi-westlands-kitisuru-kitisuru': [
      { id: 5000, name: 'Kitisuru Road' },
      { id: 5001, name: 'Loresho Ridge' },
      { id: 5002, name: 'Kyuna Close' },
      { id: 5003, name: 'Muthaiga Road' },
      { id: 5004, name: 'Spring Valley Road' },
    ],
    'nairobi-westlands-parklands/highridge-parklands': [
      { id: 5010, name: 'Parklands Road' },
      { id: 5011, name: 'Limuru Road' },
      { id: 5012, name: 'Rhapta Road' },
      { id: 5013, name: 'Mpaka Road' },
    ],
    'mombasa-mvita-mji wa kale/makadara-old town': [
      { id: 6000, name: 'Nkrumah Road' },
      { id: 6001, name: 'Moi Avenue' },
      { id: 6002, name: 'Mama Ngina Drive' },
    ],
  },
  schools: {
    'nairobi-westlands-kitisuru-kitisuru': [
      { id: 5100, name: 'Kitisuru Primary School' },
      { id: 5101, name: 'Loresho Primary School' },
      { id: 5102, name: 'Kyuna Academy' },
    ],
    'mombasa-mvita-mji wa kale/makadara-old town': [
      { id: 6100, name: 'Mombasa Primary School' },
      { id: 6101, name: 'Sacred Heart Primary' },
    ],
  },
  healthCenters: {
    'nairobi-westlands-kitisuru-kitisuru': [
      { id: 5200, name: 'Kitisuru Health Centre' },
      { id: 5201, name: 'Loresho Clinic' },
    ],
    'mombasa-mvita-mji wa kale/makadara-old town': [
      { id: 6200, name: 'Coast General Hospital' },
      { id: 6201, name: 'Mombasa Hospital' },
    ],
  },
  buildings: {
    'nairobi-westlands-kitisuru-kitisuru': [
      { id: 5300, name: 'Kitisuru Mall' },
      { id: 5301, name: 'Loresho Shopping Centre' },
    ],
    'mombasa-mvita-mji wa kale/makadara-old town': [
      { id: 6300, name: 'City Mall Mombasa' },
      { id: 6301, name: 'Ratna Square' },
    ],
  },
  markets: {
    'nairobi-westlands-kitisuru-kitisuru': [
      { id: 5400, name: 'Kitisuru Market' },
      { id: 5401, name: 'Loresho Market' },
    ],
    'mombasa-mvita-mji wa kale/makadara-old town': [
      { id: 6400, name: 'Kongowea Market' },
      { id: 6401, name: 'Marikiti Market' },
    ],
  },
}

// Helper to get test data for a given level and parent keys
export function getTestData(level, parentKeys = {}) {
  const { county, subcounty, ward, neighborhood } = parentKeys

  switch (level) {
    case 'counties':
      return counties
    case 'subcounties':
      return subCounties[county?.toLowerCase()] || []
    case 'wards':
      return wards[`${county?.toLowerCase()}-${subcounty?.toLowerCase()}`] || []
    case 'neighborhoods':
      return neighborhoods[`${county?.toLowerCase()}-${subcounty?.toLowerCase()}-${ward?.toLowerCase()}`] || []
    case 'streets':
      return landmarks.streets[`${county?.toLowerCase()}-${subcounty?.toLowerCase()}-${ward?.toLowerCase()}-${neighborhood?.toLowerCase()}`] || []
    case 'schools':
      return landmarks.schools[`${county?.toLowerCase()}-${subcounty?.toLowerCase()}-${ward?.toLowerCase()}-${neighborhood?.toLowerCase()}`] || []
    case 'health-centers':
      return landmarks.healthCenters[`${county?.toLowerCase()}-${subcounty?.toLowerCase()}-${ward?.toLowerCase()}-${neighborhood?.toLowerCase()}`] || []
    case 'buildings':
      return landmarks.buildings[`${county?.toLowerCase()}-${subcounty?.toLowerCase()}-${ward?.toLowerCase()}-${neighborhood?.toLowerCase()}`] || []
    case 'markets':
      return landmarks.markets[`${county?.toLowerCase()}-${subcounty?.toLowerCase()}-${ward?.toLowerCase()}-${neighborhood?.toLowerCase()}`] || []
    default:
      return []
  }
}