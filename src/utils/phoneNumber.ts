import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

export class PhoneNumberUtil {
  /**
   * Parse and validate a phone number, converting it to Saudi or Egyptian format
   * @param phoneNumber - The phone number string to parse
   * @returns Formatted phone number or null if invalid
   */
  static parseSaudiOrEgyptianNumber(phoneNumber: string): string | null {
    try {
      // Clean the input
      const cleaned = phoneNumber.replace(/[^\d+]/g, '');

      // Try different formats for Saudi and Egyptian numbers
      const possibleFormats = this.generatePossibleFormats(cleaned);

      for (const format of possibleFormats) {
        if (isValidPhoneNumber(format)) {
          const parsed = parsePhoneNumber(format);

          // Check if it's a Saudi or Egyptian number
          if (parsed.country === 'SA' || parsed.country === 'EG') {
            return parsed.format('E.164');
          }
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate possible phone number formats for Saudi and Egyptian numbers
   */
  private static generatePossibleFormats(cleaned: string): string[] {
    const formats: string[] = [];

    // If it already has a country code, try as is
    if (cleaned.startsWith('+')) {
      formats.push(cleaned);
    }

    // Saudi formats
    if (cleaned.startsWith('0')) {
      // Remove leading 0 and add +966
      formats.push('+966' + cleaned.substring(1));
    } else if (cleaned.startsWith('966')) {
      formats.push('+' + cleaned);
    } else if (cleaned.length === 9 && !cleaned.startsWith('+')) {
      // If it's 9 digits without country code, assume Saudi
      formats.push('+966' + cleaned);
    }

    // Egyptian formats
    if (cleaned.startsWith('0')) {
      // Remove leading 0 and add +20
      formats.push('+20' + cleaned.substring(1));
    } else if (cleaned.startsWith('20')) {
      formats.push('+' + cleaned);
    } else if (cleaned.length === 10 && !cleaned.startsWith('+')) {
      // If it's 10 digits without country code, assume Egyptian
      formats.push('+20' + cleaned);
    }

    return formats;
  }

  /**
   * Check if a phone number is valid Saudi or Egyptian number
   * @param phoneNumber - The phone number to validate
   * @returns boolean indicating if valid
   */
  static isValidSaudiOrEgyptianNumber(phoneNumber: string): boolean {
    return this.parseSaudiOrEgyptianNumber(phoneNumber) !== null;
  }

  /**
   * Get the country code for a phone number
   * @param phoneNumber - The phone number to check
   * @returns 'SA' for Saudi, 'EG' for Egyptian, or null if invalid
   */
  static getCountryCode(phoneNumber: string): 'SA' | 'EG' | null {
    try {
      const parsed = this.parseSaudiOrEgyptianNumber(phoneNumber);
      if (!parsed) return null;

      const phoneData = parsePhoneNumber(parsed);
      return phoneData.country as 'SA' | 'EG';
    } catch (error) {
      return null;
    }
  }

  /**
   * Format phone number for WhatsApp (remove + and add @s.whatsapp.net)
   * @param phoneNumber - The phone number to format
   * @returns WhatsApp formatted number or null if invalid
   */
  static formatForWhatsApp(phoneNumber: string): string | null {
    const parsed = this.parseSaudiOrEgyptianNumber(phoneNumber);
    if (!parsed) return null;

    // Remove + and add @s.whatsapp.net
    return parsed.substring(1) + '@s.whatsapp.net';
  }

  /**
   * Get a display-friendly version of the phone number
   * @param phoneNumber - The phone number to format
   * @returns Display-friendly number or null if invalid
   */
  static getDisplayNumber(phoneNumber: string): string | null {
    try {
      const parsed = this.parseSaudiOrEgyptianNumber(phoneNumber);
      if (!parsed) return null;

      const phoneData = parsePhoneNumber(parsed);
      return phoneData.formatNational();
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate Saudi phone number specifically
   * @param phoneNumber - The phone number to validate
   * @returns boolean indicating if valid Saudi number
   */
  static isValidSaudiNumber(phoneNumber: string): boolean {
    const country = this.getCountryCode(phoneNumber);
    return country === 'SA';
  }

  /**
   * Validate Egyptian phone number specifically
   * @param phoneNumber - The phone number to validate
   * @returns boolean indicating if valid Egyptian number
   */
  static isValidEgyptianNumber(phoneNumber: string): boolean {
    const country = this.getCountryCode(phoneNumber);
    return country === 'EG';
  }
}
