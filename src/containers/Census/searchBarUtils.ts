import { t } from '@lingui/macro';

import { SearchBarColumn, SearchBarColumnType } from 'src/components/SearchBar/types';

export function getCensusSearchBarColumns(): SearchBarColumn[] {
    return [
        {
            id: 'patient',
            type: SearchBarColumnType.REFERENCE,
            placeholder: t`All facilities`,
            expression: 'Patient',
            path: "name.given.first() + ' ' + name.family",
        },
        {
            id: 'practitioner',
            searchParam: 'participant-display',
            type: SearchBarColumnType.STRING,
            placeholder: t`All practitioners`,
        },
        {
            id: 'class',
            searchParam: 'class',
            type: SearchBarColumnType.CHOICE,
            placeholder: t`All types of visits`,
            options: [
                {
                    value: {
                        Coding: {
                            code: 'AMB',
                            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                            display: 'Ambulatory',
                        },
                    },
                },
                {
                    value: {
                        Coding: {
                            code: 'IMP',
                            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                            display: 'Inpatient',
                        },
                    },
                },
                {
                    value: {
                        Coding: {
                            code: 'EMER',
                            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                            display: 'Emergency',
                        },
                    },
                },
                {
                    value: {
                        Coding: {
                            code: 'HH',
                            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                            display: 'Home Health',
                        },
                    },
                },
            ],
        },
        {
            id: 'date',
            type: SearchBarColumnType.DATE,
            placeholder: [t`Start date`, t`End date`],
        },
    ];
}
