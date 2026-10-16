/**
 * The single fake shopper used to fill checkout fields during a scan.
 *
 * Never a real person and never real payment data. The agent stops before
 * any payment step, so nothing here is ever paired with a card number — see
 * `paymentFieldPattern` below, which is what enforces that.
 */
export const testIdentity = {
  firstName: 'John',
  lastName: 'Doe',
  get fullName() {
    return `${this.firstName} ${this.lastName}`;
  },
  email: 'john.doe@example.com',
  phone: '4085550147',
  address1: '123 Appleseed Lane',
  address2: '',
  city: 'Los Gatos',
  province: 'California',
  provinceCode: 'CA',
  zip: '95030',
  country: 'United States',
  countryCode: 'US',
};

/**
 * Any field matching this is a payment field. Reaching one ends the run: the
 * agent records that it got as far as payment and stops. It must never type
 * into one, on any environment, whatever the scenario asks for.
 */
export const paymentFieldPattern =
  /(card|cardnumber|credit|cvc|cvv|security[_-]?code|expiry|exp[_-]?(month|year)|payment|billing[_-]?(number|card))/i;

/**
 * Fields the shopper stops short of. Payment is obvious; billing is excluded
 * too because a checkout test ends at billing by design.
 */
export const excludedFieldPattern = new RegExp(`${paymentFieldPattern.source}|billing`, 'i');

/** Maps a checkout field's name/id/label to the value the fake shopper would enter. */
export function valueForField(descriptor: string): string | null {
  const key = descriptor.toLowerCase();
  if (excludedFieldPattern.test(key)) return null;
  if (/first[_-]?name|given[_-]?name/.test(key)) return testIdentity.firstName;
  if (/last[_-]?name|family[_-]?name|surname/.test(key)) return testIdentity.lastName;
  if (/(^|[^a-z])name([^a-z]|$)|full[_-]?name/.test(key)) return testIdentity.fullName;
  if (/e[-_]?mail/.test(key)) return testIdentity.email;
  if (/phone|tel|mobile/.test(key)) return testIdentity.phone;
  if (/address.?2|apartment|apt|suite|unit/.test(key)) return testIdentity.address2;
  if (/address|street|line1/.test(key)) return testIdentity.address1;
  if (/city|town|locality/.test(key)) return testIdentity.city;
  if (/province|state|region/.test(key)) return testIdentity.provinceCode;
  if (/zip|postal|postcode/.test(key)) return testIdentity.zip;
  if (/country/.test(key)) return testIdentity.countryCode;
  return null;
}
