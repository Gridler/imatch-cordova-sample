var mrz = {

    parseMRZ: function (mrz) {
      if (mrz == null || mrz.length != 88) {
        throw new Error('Invalid MRZ length');
      }

      let documentCode = stripPadding(mrz.substring(0, 1));
      if (documentCode != 'P') {
        throw new Error('Not a passport MRZ');
      }

      let documentType = stripPadding(mrz.substring(1, 2));
      if (documentType == '') {
        documentType = null;
      }

      try {
        let issuerOrg = stripPadding(mrz.substring(2, 5));
        let names = getNames(mrz.substring(5, 44));
        let documentNumberRaw = mrz.substring(44, 53);
        let documentNumber = stripPadding(documentNumberRaw);
        let checkDigit1 = mrz.substring(53, 54);
        let checkDigitVerify1 = checkDigitVerify(documentNumberRaw, checkDigit1);
        let nationality = getNationality(stripPadding(mrz.substring(54, 57)));
        let dobRaw = mrz.substring(57, 63);
        let dob = getFullDate(stripPadding(dobRaw));
        let checkDigit2 = mrz.substring(63, 64);
        let checkDigitVerify2 = checkDigitVerify(dobRaw, checkDigit2);
        let sex = getSex(stripPadding(mrz.substring(64, 65)));
        let expiryRaw = mrz.substring(65, 71);
        let expiry = getFullDate(stripPadding(expiryRaw));
        let checkDigit3 = stripPadding(mrz.substring(71, 72));
        let checkDigitVerify3 = checkDigitVerify(expiryRaw, checkDigit3);
        let personalNumberRaw = mrz.substring(72, 86);
        let personalNumber = stripPadding(personalNumberRaw);
        let checkDigit4 = mrz.substring(86, 87);
        let checkDigitVerify4 = checkDigitVerify(personalNumberRaw, checkDigit4);
        let checkDigit5 = mrz.substring(87, 88);
        let finalCheckDigitRaw = documentNumberRaw + checkDigit1 + dobRaw + checkDigit2 + expiryRaw + checkDigit3 + personalNumberRaw + checkDigit4;
        let checkDigitVerify5 = checkDigitVerify(finalCheckDigitRaw, checkDigit5);

        return {
          documentNumber: documentNumber,
          personalNumber: personalNumber,
          issuingState: issuerOrg,
          primaryIdentifier: '',
          secondaryIdentifier: '',
          gender: sex,
          nationality: nationality,
          dateOfBirth: dob,
          dateOfExpiry: expiry,
          documentCode: documentCode,
          documentType: 'PASSPORT',
          documentTypeCode: documentType,
          names: names,
          checkDigit: {
            documentNumber: {value: checkDigit1, valid: checkDigitVerify1},
            dob: {value: checkDigit2, valid: checkDigitVerify2},
            expiry: {value: checkDigit3, valid: checkDigitVerify3},
            personalNumber: {value: checkDigit4, valid: checkDigitVerify4},
            finalCheck: {value: checkDigit5, valid: checkDigitVerify5},
            valid: (checkDigitVerify1 && checkDigitVerify2 && checkDigitVerify3 && checkDigitVerify4 && checkDigitVerify5)
          },
        };
      } catch (err) {
        throw err;
      }
    }

 };

var stripPadding = function (str) {
  if (!str || typeof str === 'undefined' | str == null) {
    return str;
  } else {
    if (str instanceof Array) {
      for (var i = 0; i < str.length; i++) {
        str[i] = stripPadding(str[i]);
        if (str[i] == '') {
          str.splice(i, 1);
          // reset i so we can loop through remaining elements
          i = 0;
        }
      }
      return str;
    } else {
      return str.replace(/</g, ' ').trim();
    }
  }
};

var getNames = function (str) {
  let names = str.split('<<');
  names = stripPadding(names);
  return {
    lastName: names[0],
    names: names[1].split(' ')
  };
};

/**
 * Get the full date value for the shortened date specified and also take
 * into account the 19xx/20xx centennial into account when calculating the
 * correct year value to return.
 *
 * @param str The shortened date
 * @returns {{year: *, month: string, day: string, original: *}}
 * @private
 */
var getFullDate = function (str) {
  let d = new Date();
  d.setFullYear(d.getFullYear() + 15);
  let centennial = (""+d.getFullYear()).substring(2, 4);

  let year;
  if (str.substring(0, 2) > centennial) {
    year = '19' + str.substring(0, 2);
  } else {
    year = '20' + str.substring(0, 2);
  }

  return {
    year: year,
    month: str.substring(2, 4),
    day: str.substring(4, 6),
    original: str
  };
};

/**
 * Get the gender/sex of the person using the sex/gender character specified.
 *
 * @param str The gender/sex character
 * @returns {{abbr: *, full: *}} - The abbreviation (character) and the full gender/sex text
 * @private
 */
var getSex = function (str) {
  let abbr;
  let full;
  if (str == 'M') {
    abbr = 'M';
    full = 'Male';
  } else if (str == 'F') {
    abbr = 'F';
    full = 'Female';
  } else {
    abbr = 'X';
    full = 'Unspecified';
  }
  return {
    abbr: abbr,
    full: full
  };
};

/**
 * Get the country/territory name using the ISO code of the nationality value.
 *
 * @param str The ISO code of the Country/Territory
 * @returns {{abbr: *, full: *}} - The abbreviation (ISO) and the full country/territory name
 * @private
 */
var getNationality = function (str) {
  let region = countries[str];
  if (!region) {
    throw new Error('Invalid region');
  }

  return {
    abbr: str,
    full: region
  };
};

/**
 * Performs the verification of the string to match the check digit.
 * This is used to check the validity of the value of the string to check for any counter-fit issues.
 *
 * @param str The value to perform the validation on
 * @param digit The value of the check digit which is to be compared to the result of the algorithm
 * @returns {boolean} Whether the computed result of the value specified matches the check digit value
 * @private
 */
var checkDigitVerify = function (str, digit) {
  let nmbrs = [];
  let weighting = [7, 3, 1];
  for (let i = 0; i < str.length; i++) {
    if (str[i].match(/[A-Za-z<]/)) {
      nmbrs.push(checkDigitValues[str[i]]);
    } else {
      nmbrs.push(parseInt(str[i]));
    }
  }

  let curWeight = 0;
  let total = 0;
  for (let j = 0; j < nmbrs.length; j++) {
    total += (nmbrs[j] * weighting[curWeight]);
    curWeight++;
    if (curWeight == 3) {
      curWeight = 0;
    }
  }

  return ((total % 10) == digit);
};

const checkDigitValues = [];
checkDigitValues["<"] = 0;
checkDigitValues["A"] = 10;
checkDigitValues["B"] = 11;
checkDigitValues["C"] = 12;
checkDigitValues["D"] = 13;
checkDigitValues["E"] = 14;
checkDigitValues["F"] = 15;
checkDigitValues["G"] = 16;
checkDigitValues["H"] = 17;
checkDigitValues["I"] = 18;
checkDigitValues["J"] = 19;
checkDigitValues["K"] = 20;
checkDigitValues["L"] = 21;
checkDigitValues["M"] = 22;
checkDigitValues["N"] = 23;
checkDigitValues["O"] = 24;
checkDigitValues["P"] = 25;
checkDigitValues["Q"] = 26;
checkDigitValues["R"] = 27;
checkDigitValues["S"] = 28;
checkDigitValues["T"] = 29;
checkDigitValues["U"] = 30;
checkDigitValues["V"] = 31;
checkDigitValues["W"] = 32;
checkDigitValues["X"] = 33;
checkDigitValues["Y"] = 34;
checkDigitValues["Z"] = 35;

const countries = [];
countries["AFG"] = "Afghanistan";
countries["ALB"] = "Albania";
countries["DZA"] = "Algeria";
countries["ASM"] = "American Samoa";
countries["AND"] = "Andorra";
countries["AGO"] = "Angola";
countries["AIA"] = "Anguilla";
countries["ATA"] = "Antarctica";
countries["ATG"] = "Antigua and Barbuda";
countries["ARG"] = "Argentina";
countries["ARM"] = "Armenia";
countries["ABW"] = "Aruba";
countries["AUS"] = "Australia";
countries["AUT"] = "Austria";
countries["AZE"] = "Azerbaijan";
countries["BHS"] = "Bahamas";
countries["BHR"] = "Bahrain";
countries["BGD"] = "Bangladesh";
countries["BRB"] = "Barbados";
countries["BLR"] = "Belarus";
countries["BEL"] = "Belgium";
countries["BLZ"] = "Belize";
countries["BEN"] = "Benin";
countries["BMU"] = "Bermuda";
countries["BTN"] = "Bhutan";
countries["BOL"] = "Bolivia";
countries["BIH"] = "Bosnia and Herzegovina";
countries["BWA"] = "Botswana";
countries["BVT"] = "Bouvet Island";
countries["BRA"] = "Brazil";
countries["IOT"] = "British Indian Ocean Territory";
countries["BRN"] = "Brunei Darussalam";
countries["BGR"] = "Bulgaria";
countries["BFA"] = "Burkina Faso";
countries["BDI"] = "Burundi";
countries["KHM"] = "Cambodia";
countries["CMR"] = "Cameroon";
countries["CAN"] = "Canada";
countries["CPV"] = "Cape Verde";
countries["CYM"] = "Cayman Islands";
countries["CAF"] = "Central African Republic";
countries["TCD"] = "Chad";
countries["CHL"] = "Chile";
countries["CHN"] = "China";
countries["CXR"] = "Christmas Island";
countries["CCK"] = "Cocos (Keeling) Islands";
countries["COL"] = "Colombia";
countries["COM"] = "Comoros";
countries["COG"] = "Congo";
countries["COK"] = "Cook Islands";
countries["CRI"] = "Costa Rica";
countries["CIV"] = "Côte d'Ivoire";
countries["HRV"] = "Croatia";
countries["CUB"] = "Cuba";
countries["CYP"] = "Cyprus";
countries["CZE"] = "Czech Republic";
countries["PRK"] = "Democratic People's Republic of Korea";
countries["COD"] = "Democratic Republic of the Congo";
countries["DNK"] = "Denmark";
countries["DJI"] = "Djibouti";
countries["DMA"] = "Dominica";
countries["DOM"] = "Dominican Republic";
countries["TMP"] = "East Timor";
countries["ECU"] = "Ecuador";
countries["EGY"] = "Egypt";
countries["SLV"] = "El Salvador";
countries["GNQ"] = "Equatorial Guinea";
countries["ERI"] = "Eritrea";
countries["EST"] = "Estonia";
countries["ETH"] = "Ethiopia";
countries["FLK"] = "Falkland Islands (Malvinas)";
countries["FRO"] = "Faeroe Islands";
countries["FJI"] = "Fiji";
countries["FIN"] = "Finland";
countries["FRA"] = "France";
countries["FXX"] = "France, Metropolitan";
countries["GUF"] = "French Guiana";
countries["PYF"] = "French Polynesia";
countries["GAB"] = "Gabon";
countries["GMB"] = "Gambia";
countries["GEO"] = "Georgia";
countries["D"] = "Germany";
countries["GHA"] = "Ghana";
countries["GIB"] = "Gibraltar";
countries["GRC"] = "Greece";
countries["GRL"] = "Greenland";
countries["GRD"] = "Grenada";
countries["GLP"] = "Guadeloupe";
countries["GUM"] = "Guam";
countries["GTM"] = "Guatemala";
countries["GIN"] = "Guinea";
countries["GNB"] = "Guinea-Bissau";
countries["GUY"] = "Guyana";
countries["HTI"] = "Haiti";
countries["HMD"] = "Heard and McDonald Islands";
countries["VAT"] = "Holy See (Vatican City State)";
countries["HND"] = "Honduras";
countries["HKG"] = "Hong Kong";
countries["HUN"] = "Hungary";
countries["ISL"] = "Iceland";
countries["IND"] = "India";
countries["IDN"] = "Indonesia";
countries["IRN"] = "Iran, Islamic Republic of";
countries["IRQ"] = "Iraq";
countries["IRL"] = "Ireland";
countries["ISR"] = "Israel";
countries["ITA"] = "Italy";
countries["JAM"] = "Jamaica";
countries["JPN"] = "Japan";
countries["JOR"] = "Jordan";
countries["KAZ"] = "Kazakhstan";
countries["KEN"] = "Kenya";
countries["KIR"] = "Kiribati";
countries["KWT"] = "Kuwait";
countries["KGZ"] = "Kyrgyzstan";
countries["LAO"] = "Lao People's Democratic Republic";
countries["LVA"] = "Latvia";
countries["LBN"] = "Lebanon";
countries["LSO"] = "Lesotho";
countries["LBR"] = "Liberia";
countries["LBY"] = "Libyan Arab Jamahiriya";
countries["LIE"] = "Liechtenstein";
countries["LTU"] = "Lithuania";
countries["LUX"] = "Luxembourg";
countries["MDG"] = "Madagascar";
countries["MWI"] = "Malawi";
countries["MYS"] = "Malaysia";
countries["MDV"] = "Maldives";
countries["MLI"] = "Mali";
countries["MLT"] = "Malta";
countries["MHL"] = "Marshall Islands";
countries["MTQ"] = "Martinique";
countries["MRT"] = "Mauritania";
countries["MUS"] = "Mauritius";
countries["MYT"] = "Mayotte";
countries["MEX"] = "Mexico";
countries["FSM"] = "Micronesia, Federated States of";
countries["MCO"] = "Monaco";
countries["MNG"] = "Mongolia";
countries["MNE"] = "Montenegro";
countries["MSR"] = "Montserrat";
countries["MAR"] = "Morocco";
countries["MOZ"] = "Mozambique";
countries["MMR"] = "Myanmar";
countries["NAM"] = "Namibia";
countries["NRU"] = "Nauru";
countries["NPL"] = "Nepal";
countries["NLD"] = "Netherlands, Kingdom of the";
countries["ANT"] = "Netherlands Antilles";
countries["NTZ"] = "Neutral Zone";
countries["NCL"] = "New Caledonia";
countries["NZL"] = "New Zealand";
countries["NIC"] = "Nicaragua";
countries["NER"] = "Niger";
countries["NGA"] = "Nigeria";
countries["NIU"] = "Niue";
countries["NFK"] = "Norfolk Island";
countries["MNP"] = "Northern Mariana Islands";
countries["NOR"] = "Norway";
countries["OMN"] = "Oman";
countries["PAK"] = "Pakistan";
countries["PLW"] = "Palau";
countries["PSE"] = "Palestine";
countries["PAN"] = "Panama";
countries["PNG"] = "Papua New Guinea";
countries["PRY"] = "Paraguay";
countries["PER"] = "Peru";
countries["PHL"] = "Philippines";
countries["PCN"] = "Pitcairn";
countries["POL"] = "Poland";
countries["PRT"] = "Portugal";
countries["PRI"] = "Puerto Rico";
countries["QAT"] = "Qatar";
countries["KOR"] = "Republic of Korea";
countries["MDA"] = "Republic of Moldova";
countries["REU"] = "Réunion";
countries["ROU"] = "Romania";
countries["RUS"] = "Russian Federation";
countries["RWA"] = "Rwanda";
countries["SHN"] = "Saint Helena";
countries["KNA"] = "Saint Kitts and Nevis";
countries["LCA"] = "Saint Lucia";
countries["SPM"] = "Saint Pierre and Miquelon";
countries["VCT"] = "Saint Vincent and the Grenadines";
countries["WSM"] = "Samoa";
countries["SMR"] = "San Marino";
countries["STP"] = "Sao Tome and Principe";
countries["SAU"] = "Saudi Arabia";
countries["SRB"] = "Serbia";
countries["SEN"] = "Senegal";
countries["SYC"] = "Seychelles";
countries["SLE"] = "Sierra Leone";
countries["SGP"] = "Singapore";
countries["SVK"] = "Slovakia";
countries["SVN"] = "Slovenia";
countries["SLB"] = "Solomon Islands";
countries["SOM"] = "Somalia";
countries["ZAF"] = "South Africa";
countries["SGS"] = "South Georgia and the South Sandwich Island";
countries["SSD"] = "South Sudan";
countries["ESP"] = "Spain";
countries["LKA"] = "Sri Lanka";
countries["SDN"] = "Sudan";
countries["SUR"] = "Suriname";
countries["SJM"] = "Svalbard and Jan Mayen Islands";
countries["SWZ"] = "Swaziland";
countries["SWE"] = "Sweden";
countries["CHE"] = "Switzerland";
countries["SYR"] = "Syrian Arab Republic";
countries["TWN"] = "Taiwan Province of China";
countries["TJK"] = "Tajikistan";
countries["TLS"] = "Timor Leste";
countries["THA"] = "Thailand";
countries["MKD"] = "The former Yugoslav Republic of Macedonia";
countries["TGO"] = "Togo";
countries["TKL"] = "Tokelau";
countries["TON"] = "Tonga";
countries["TTO"] = "Trinidad and Tobago";
countries["TUN"] = "Tunisia";
countries["TUR"] = "Turkey";
countries["TKM"] = "Turkmenistan";
countries["TCA"] = "Turks and Caicos Islands";
countries["TUV"] = "Tuvalu";
countries["UGA"] = "Uganda";
countries["UKR"] = "Ukraine";
countries["ARE"] = "United Arab Emirates";
countries["GBR"] = "United Kingdom of Great Britain and Northern Ireland Citizen";
countries["GBD"] = "United Kingdom of Great Britain and Northern Ireland Dependent Territories Citizen";
countries["GBN"] = "United Kingdom of Great Britain and Northern Ireland National (oversees)";
countries["GBO"] = "United Kingdom of Great Britain and Northern Ireland Oversees Citizen";
countries["GBP"] = "United Kingdom of Great Britain and Northern Ireland Protected Person";
countries["GBS"] = "United Kingdom of Great Britain and Northern Ireland Subject";
countries["TZA"] = "United Republic of Tanzania";
countries["USA"] = "United States of America";
countries["UMI"] = "United States of America Minor Outlying Islands";
countries["URY"] = "Uruguay";
countries["UZB"] = "Uzbekistan";
countries["VUT"] = "Vanuatu";
countries["VEN"] = "Venezuela";
countries["VNM"] = "Viet Nam";
countries["VGB"] = "Virgin Islands (Great Britian)";
countries["VIR"] = "Virgin Islands (United States)";
countries["WLF"] = "Wallis and Futuna Islands";
countries["ESH"] = "Western Sahara";
countries["YEM"] = "Yemen";
countries["ZAR"] = "Zaire";
countries["ZMB"] = "Zambia";
countries["ZWE"] = "Zimbabwe";
countries["UNO"] = "United Nations Organization Official";
countries["UNA"] = "United Nations Organization Specialized Agency Official";
countries["XAA"] = "Stateless (per Article 1 of 1954 convention)";
countries["XXB"] = "Refugee (per Article 1 of 1951 convention, amended by 1967 protocol)";
countries["XXC"] = "Refugee (non-convention)";
countries["XXX"] = "Unspecified / Unknown";
