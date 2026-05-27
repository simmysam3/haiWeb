// Curated FlagComponent map shared by the audit run-detail SKU header and the
// audit history table's per-row domestic indicator. Add new ISO-2 entries
// here (and to the import list below) as new HAIWAVE participants onboard;
// unknown codes silently render no flag.

import {
  US, CA, MX, GB, DE, FR, IT, ES, NL, IE, SE, NO, FI, DK, PL,
  JP, KR, CN, IN, AU, NZ, SG, HK, TW, BR, AR, CL, ZA, TR,
} from 'country-flag-icons/react/3x2';

// Typed by `typeof US` so the map element type matches the package's
// FlagComponent signature without redeclaring its prop shape.
export const FLAG_COMPONENTS: Record<string, typeof US> = {
  US, CA, MX, GB, DE, FR, IT, ES, NL, IE, SE, NO, FI, DK, PL,
  JP, KR, CN, IN, AU, NZ, SG, HK, TW, BR, AR, CL, ZA, TR,
};
