/** Builds a small synthetic annual iXBRL document (values in millions, scale=6). */
const ctx = (id: string, period: string, dim = false) =>
  `<xbrli:context id="${id}"><xbrli:entity><xbrli:identifier scheme="http://www.sec.gov/CIK">0000000001</xbrli:identifier>${
    dim ? '<xbrli:segment><xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">x:SegA</xbrldi:explicitMember></xbrli:segment>' : ''
  }</xbrli:entity><xbrli:period>${period}</xbrli:period></xbrli:context>`

const dur = (s: string, e: string) => `<xbrli:startDate>${s}</xbrli:startDate><xbrli:endDate>${e}</xbrli:endDate>`
const inst = (d: string) => `<xbrli:instant>${d}</xbrli:instant>`

const num = (name: string, c: string, v: string, extra = '') =>
  `<ix:nonFraction name="${name}" contextRef="${c}" unitRef="usd" decimals="-6" scale="6" ${extra}>${v}</ix:nonFraction>`

export type Overrides = Record<string, string>

export function buildFixture(o: Overrides = {}): string {
  const g = (k: string, d: string) => o[k] ?? d
  const f = (name: string, c: string, v: string) => num(name, c, v)
  return `<html xmlns:ix="http://www.xbrl.org/2013/inlineXBRL"><body>
<ix:header><ix:resources>
${ctx('FY24', dur('2024-01-01', '2024-12-31'))}
${ctx('FY23', dur('2023-01-01', '2023-12-31'))}
${ctx('E24', inst('2024-12-31'))}
${ctx('E23', inst('2023-12-31'))}
${ctx('SEG24', dur('2024-01-01', '2024-12-31'), true)}
</ix:resources></ix:header>
<ix:nonNumeric name="dei:DocumentType" contextRef="FY24">10-K</ix:nonNumeric>
<ix:nonNumeric name="dei:EntityRegistrantName" contextRef="FY24">Test Corp</ix:nonNumeric>
<ix:nonNumeric name="dei:DocumentPeriodEndDate" contextRef="FY24">December 31, 2024</ix:nonNumeric>
<ix:nonNumeric name="dei:DocumentFiscalPeriodFocus" contextRef="FY24">FY</ix:nonNumeric>
${f('us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax', 'FY24', g('rev24', '1,000'))}
${f('us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax', 'FY23', g('rev23', '800'))}
${f('us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax', 'SEG24', '9,999')}
${f('us-gaap:CostOfGoodsAndServicesSold', 'FY24', '600')}
${f('us-gaap:CostOfGoodsAndServicesSold', 'FY23', '500')}
${f('us-gaap:OperatingIncomeLoss', 'FY24', g('oi24', '200'))}
${f('us-gaap:OperatingIncomeLoss', 'FY23', '120')}
${f('us-gaap:NetIncomeLoss', 'FY24', g('ni24', '150'))}
${f('us-gaap:NetIncomeLoss', 'FY23', '90')}
${f('us-gaap:InterestExpense', 'FY24', '10')}
<ix:nonFraction name="us-gaap:EarningsPerShareDiluted" contextRef="FY24" unitRef="usdPerShare" decimals="2">1.50</ix:nonFraction>
<ix:nonFraction name="us-gaap:EarningsPerShareDiluted" contextRef="FY23" unitRef="usdPerShare" decimals="2">0.90</ix:nonFraction>
${f('us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding', 'FY24', '100')}
${f('us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding', 'FY23', '105')}
${f('us-gaap:NetCashProvidedByUsedInOperatingActivities', 'FY24', g('ocf24', '180'))}
${f('us-gaap:NetCashProvidedByUsedInOperatingActivities', 'FY23', '100')}
${f('us-gaap:PaymentsToAcquirePropertyPlantAndEquipment', 'FY24', '40')}
${f('us-gaap:DepreciationDepletionAndAmortization', 'FY24', '30')}
${f('us-gaap:Assets', 'E24', '2,000')}
${f('us-gaap:Assets', 'E23', '1,800')}
${f('us-gaap:AssetsCurrent', 'E24', '800')}
${f('us-gaap:AssetsCurrent', 'E23', '700')}
${f('us-gaap:LiabilitiesCurrent', 'E24', '400')}
${f('us-gaap:LiabilitiesCurrent', 'E23', '420')}
${f('us-gaap:CashAndCashEquivalentsAtCarryingValue', 'E24', '300')}
${f('us-gaap:AccountsReceivableNetCurrent', 'E24', '150')}
${f('us-gaap:InventoryNet', 'E24', '100')}
${f('us-gaap:AccountsPayableCurrent', 'E24', '80')}
${f('us-gaap:Liabilities', 'E24', '900')}
${f('us-gaap:Liabilities', 'E23', '900')}
${f('us-gaap:StockholdersEquity', 'E24', '1,100')}
${f('us-gaap:StockholdersEquity', 'E23', '900')}
${f('us-gaap:RetainedEarningsAccumulatedDeficit', 'E24', '500')}
${f('us-gaap:LongTermDebtNoncurrent', 'E24', '400')}
${f('us-gaap:LongTermDebtNoncurrent', 'E23', '500')}
</body></html>`
}
