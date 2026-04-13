import { t } from '@lingui/macro';

import { SearchBarColumn, SearchBarColumnType } from 'src/components/SearchBar/types';

export function getCensusListSearchBarColumns(): SearchBarColumn[] {
    return [
        {
            id: 'location',
            searchParam: 'location',
            type: SearchBarColumnType.REFERENCE,
            expression: 'Location',
            path: 'name',
            placeholder: t`All facilities`,
        },
        {
            id: 'practitioner',
            searchParam: 'participant',
            type: SearchBarColumnType.REFERENCE,
            expression: 'Practitioner',
            path: "name.given.first() + ' ' + name.family",
            placeholder: t`All practitioners`,
        },
        {
            id: 'type',
            searchParam: 'type',
            type: SearchBarColumnType.CHOICE,
            placeholder: t`All types of visits`,
            options: [
                {
                    value: {
                        Coding: {
                            code: 'AMB',
                            display: 'Ambulatory',
                            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                        },
                    },
                },
                {
                    value: {
                        Coding: {
                            code: 'IMP',
                            display: 'Inpatient',
                            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                        },
                    },
                },
                {
                    value: {
                        Coding: {
                            code: 'EMER',
                            display: 'Emergency',
                            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                        },
                    },
                },
                {
                    value: {
                        Coding: {
                            code: 'HH',
                            display: 'Home Health',
                            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
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
