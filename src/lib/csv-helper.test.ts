import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { escapeCsvField, generateCsvString, parseCsvText } from './csv-helper'

describe('CSV Utility & Export Currency Formatting', () => {
  it('escapes fields correctly and prevents formula injection without altering numbers', () => {
    assert.equal(escapeCsvField('Hello'), 'Hello')
    assert.equal(escapeCsvField('Hello, World'), '"Hello, World"')
    assert.equal(escapeCsvField('Quote "test"'), '"Quote ""test"""')
    assert.equal(escapeCsvField(430), '430')
    assert.equal(escapeCsvField(430.00), '430')
    assert.equal(escapeCsvField(-50.25), '-50.25')
    assert.equal(escapeCsvField('430.00'), '430.00')
    assert.equal(escapeCsvField('-120.00'), '-120.00')

    // Formula injection attempts
    assert.equal(escapeCsvField('=SUM(A1:B1)'), "'=SUM(A1:B1)")
    assert.equal(escapeCsvField('+12345'), "'+12345")
    assert.equal(escapeCsvField('+cmd|...'), "'+cmd|...")
    assert.equal(escapeCsvField('@leak'), "'@leak")
  })

  it('correctly converts paisa values to NPR Rupees in CSV output', () => {
    interface SampleOrder {
      number: string
      subtotalPaisa: number
      deliveryChargePaisa: number
      vatPaisa: number
      totalPaisa: number
    }

    const order: SampleOrder = {
      number: 'MZ-10009',
      subtotalPaisa: 43000,
      deliveryChargePaisa: 0,
      vatPaisa: 4947,
      totalPaisa: 43000,
    }

    const csv = generateCsvString(
      [
        { header: 'OrderNumber', key: 'number' },
        { header: 'SubtotalNPR', value: (o) => (o.subtotalPaisa / 100).toFixed(2) },
        { header: 'DeliveryChargeNPR', value: (o) => (o.deliveryChargePaisa / 100).toFixed(2) },
        { header: 'TaxVATNPR', value: (o) => (o.vatPaisa / 100).toFixed(2) },
        { header: 'TotalNPR', value: (o) => (o.totalPaisa / 100).toFixed(2) },
      ],
      [order],
    )

    const expected =
      'OrderNumber,SubtotalNPR,DeliveryChargeNPR,TaxVATNPR,TotalNPR\n' +
      'MZ-10009,430.00,0.00,49.47,430.00'

    assert.equal(csv, expected)

    const parsed = parseCsvText(csv)
    assert.equal(parsed.rows.length, 1)
    assert.equal(parsed.rows[0].TotalNPR, '430.00')
    assert.notEqual(parsed.rows[0].TotalNPR, '43000')
  })
})
