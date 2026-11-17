// Tests for mapKycReport — the KYC report endpoint payload
// (GET /api/origination/reports/kyc/?id=) → ViewApplicationContent view model.
// Fixture mirrors the real payload shape (see application_details.json sample).

import { describe, it, expect } from 'vitest'
import { mapKycReport } from './mappers'

const PAYLOAD = {
  application_details: {
    id: 98,
    person: {
      id: 3,
      first_name: 'Jane',
      middle_name: '',
      last_name: 'Doe',
      email: 'info@gmail.com',
      phone_number: '0729483248',
      id_number: '88888888',
    },
    address: 98,
    employment: 98,
    loan_product: {
      id: 19,
      name: 'Digital Loan',
      product_type: 'personal_loan',
      currency: 'KES',
      interest_rate: { source: '4.0', parsedValue: 4 },
      processing_fee: 'Free',
      cost_of_credit: { source: '4.0', parsedValue: 4 },
    },
    requested_amount: { source: '1000.0', parsedValue: 1000 },
    monthly_payment: { source: '0.0', parsedValue: 0 },
    status: 'PENDING',
    reference: '1235',
    created_at: '2026-10-30T11:47:01.970814Z',
    updated_at: '2026-10-30T11:47:01.970824Z',
  },
  loan_aplication_ref: '1235',
  requested_amount: { source: '1000.0', parsedValue: 1000 },
  loan_term: 1,
  monthly_payment: { source: '0.0', parsedValue: 0 },
  report_ref_number: 'KYC-88888888-20261101114812',
  report_generated_at: '2026-11-01 11:48:12',
  report_generated_by: 'John Doe',
  org_name: 'XYZ Bank',
  report_title: 'KYC Details Report',
  personal_details: {
    passportPhoto: '/media/loan_docs/biometrics/biometric_front_knOPjvX.jpg',
    firstName: 'Jane',
    middleName: '',
    lastName: 'Doe',
    idNumber: '88888888',
    other_aliases: ['JANE DOE', 'JANET DOE HARRY'],
    dateOfBirth: '1954-01-01',
    gender: 'M',
    marital_status: null,
    is_verified: true,
    loan_product: {
      id: 19,
      name: 'Digital Loan',
      product_type: 'personal_loan',
      currency: 'KES',
      interest_rate: { source: '4.0', parsedValue: 4 },
      processing_fee: 'Free',
      cost_of_credit: { source: '4.0', parsedValue: 4 },
    },
    person_documents: {
      id_photo_front: '/media/loan_docs/ids/front/id_copy_ur58HW5.pdf',
      id_photo_back: null,
      biometric_photo_1: '/media/loan_docs/biometrics/biometric_front_knOPjvX.jpg',
      biometric_photo_2: null,
      biometric_photo_3: null,
      kra_certificate: '/media/loan_docs/kra/certificates/kra_3gEWhpp.pdf',
      proof_of_business: null,
      bank_statement: null,
      mpesa_statement: null,
      payslip: '/media/loan_docs/payslips/payslip32_2kXsn7M.pdf',
      utility_bill: null,
    },
    contacts: {
      email: 'info@gmail.com',
      other_emails: ['janedoe@yahoo.com'],
      phone_numbers: ['0729483248'],
      other_phone_numbers: ['0722707660', '058320188'],
      postalAddress: 'P.O. Box P.O BOX 326 - 40202, KEROKA',
      otherPostalAddresses: [
        { code: '40202', town: 'KEROKA', number: 'P.O BOX 326', country: 'Kenya' },
      ],
      physicalAddress: [
        {
          building_or_premise: '',
          unit_or_house_number: '',
          street_or_road_name: 'Malanga Street',
          estate_or_neighborhood: 'California',
          landmark_school: 'New Pumwani Primary School',
          landmark_health: 'Care Hospital',
          landmark_church: '',
          sub_county: 'Kamukunji',
          county: 'Nairobi',
          is_verified: true,
          spatial_dossier: {
            markers: [
              {
                id: 'health',
                label: 'Care Hospital',
                category: 'Health Facility',
                latitude: -1.280504,
                longitude: 36.846765,
                color: 'orange',
              },
            ],
            street_polyline: {
              name: 'Malanga Street',
              coordinates: [
                [-1.28363, 36.8470515],
                [-1.2836441, 36.8467558],
              ],
            },
          },
        },
      ],
      residential_history: [
        { town: 'Keroka', address: 'Keroka', country: 'Kenya', plot_number: null },
      ],
    },
    employment: [
      { employer_name: 'Acne', job_title: null, monthly_income: '900000.00', employment_status: 'EMPLOYED' },
    ],
    known_employment_history: [
      { position: null, department: null, salary_band: '0 to 15,000', employer_name: 'SELF EMPLOYED', employment_date: null },
    ],
  },
}

describe('mapKycReport', () => {
  const vm = mapKycReport(PAYLOAD)

  it('maps the report header', () => {
    expect(vm.customer).toBe('Jane Doe')
    expect(vm.report.title).toBe('KYC Details Report')
    expect(vm.report.reference).toBe('KYC-88888888-20261101114812')
    expect(vm.report.organization).toBe('XYZ Bank')
    expect(vm.report.generatedAt).toBe('2026-11-01 11:48:12')
    expect(vm.report.generatedBy).toBe('John Doe')
  })

  it('maps loan details', () => {
    expect(vm.loan.product).toBe('Digital Loan')
    expect(vm.loan.productType).toBe('personal_loan')
    expect(vm.loan.currency).toBe('KES')
    expect(vm.loan.amount).toContain('1,000')
    expect(vm.loan.term).toBe('1 month')
    expect(vm.loan.monthly).toBe('—') // 0 → not calculated
    expect(vm.loan.interest).toBe('4%')
    expect(vm.loan.fee).toBe('Free')
    expect(vm.loan.cost).toBe('4%')
    expect(vm.loan.status).toBe('Pending')
    expect(vm.loan.submitted).toBe('30 Oct 2026')
    expect(vm.loan.updated).toBe('30 Oct 2026')
  })

  it('maps personal details', () => {
    expect(vm.personal.firstName).toBe('Jane')
    expect(vm.personal.surname).toBe('Doe')
    expect(vm.personal.otherNames).toBe('—')
    expect(vm.personal.idNumber).toBe('88888888')
    expect(vm.personal.dob).toContain('1954')
    expect(vm.personal.gender).toBe('Male')
    expect(vm.personal.marital).toBe('—')
    expect(vm.personal.aliases).toBe('JANE DOE, JANET DOE HARRY')
    expect(vm.personal.verified).toBe('Yes')
    expect(vm.personal.photo).toContain('/media/')
  })

  it('maps documents, skipping missing fields, with kinds and urls', () => {
    const ids = vm.documents.map((d) => d.id)
    expect(ids).toEqual(['id_photo_front', 'biometric_photo_1', 'kra_certificate', 'payslip'])
    const payslip = vm.documents.find((d) => d.id === 'payslip')
    expect(payslip.kind).toBe('pdf')
    expect(payslip.url).toContain('/media/loan_docs/payslips/')
    expect(vm.documents.find((d) => d.id === 'biometric_photo_1').kind).toBe('image')
  })

  it('filters empty_* placeholder files out of the document list', () => {
    const withPlaceholders = mapKycReport({
      ...PAYLOAD,
      personal_details: {
        ...PAYLOAD.personal_details,
        person_documents: {
          ...PAYLOAD.personal_details.person_documents,
          id_photo_front: '/media/loan_docs/ids/front/empty_4xjHwyc',
        },
      },
    })
    expect(withPlaceholders.documents.map((d) => d.id)).not.toContain('id_photo_front')
  })

  it('maps contacts, physical address and map data', () => {
    expect(vm.contact.email).toBe('info@gmail.com')
    expect(vm.contact.phone).toBe('0729483248')
    expect(vm.contact.otherEmails).toBe('janedoe@yahoo.com')
    expect(vm.contact.otherPhones).toBe('0722707660, 058320188')
    expect(vm.contact.postal).toContain('P.O. Box')
    expect(vm.contact.otherPostal).toBe('P.O. Box P.O BOX 326 - 40202, KEROKA')
    expect(vm.contact.building).toBe('—')
    expect(vm.contact.street).toBe('Malanga Street')
    expect(vm.contact.estate).toBe('California')
    expect(vm.contact.school).toBe('New Pumwani Primary School')
    expect(vm.contact.health).toBe('Care Hospital')
    expect(vm.contact.subCounty).toBe('Kamukunji')
    expect(vm.contact.county).toBe('Nairobi')
    expect(vm.contact.mapLabel).toBe('Care Hospital')
    expect(vm.contact.mapCenter[0]).toBeCloseTo(-1.280504)
    expect(vm.contact.mapCenter[1]).toBeCloseTo(36.846765)
    expect(vm.contact.markers).toHaveLength(1)
    expect(vm.contact.polyline.name).toBe('Malanga Street')
    expect(vm.contact.polyline.coordinates).toHaveLength(2)
  })

  it('maps residential history', () => {
    expect(vm.residential).toHaveLength(1)
    expect(vm.residential[0].town).toBe('Keroka')
    expect(vm.residential[0].plot).toBe('—')
  })

  it('maps employment', () => {
    expect(vm.employment.current.employer).toBe('Acne')
    expect(vm.employment.current.title).toBe('—')
    expect(vm.employment.current.income).toContain('900,000')
    expect(vm.employment.current.status).toBe('Employed')
    expect(vm.employment.history.salaryBand).toBe('0 to 15,000')
    expect(vm.employment.history.employer).toBe('SELF EMPLOYED')
    expect(vm.employment.history.date).toBe('—')
  })

  it('falls back to the Nairobi center when there are no geo markers', () => {
    const noGeo = mapKycReport({
      ...PAYLOAD,
      personal_details: {
        ...PAYLOAD.personal_details,
        contacts: { ...PAYLOAD.personal_details.contacts, physicalAddress: [{}] },
      },
    })
    expect(noGeo.contact.mapCenter).toEqual([-1.2833, 36.8180])
    expect(noGeo.contact.markers).toEqual([])
    expect(noGeo.contact.polyline).toBeNull()
  })

  it('is null-safe on degenerate payloads', () => {
    expect(mapKycReport(null)).toBeNull()
    const minimal = mapKycReport({ application_details: null, personal_details: { contacts: {} } })
    expect(minimal.customer).toBe('—')
    expect(minimal.documents).toEqual([])
    expect(minimal.residential).toEqual([])
    expect(minimal.employment.current).toBeNull()
    expect(minimal.loan.amount).toBe('—')
    expect(minimal.loan.status).toBe('—')
  })
})
