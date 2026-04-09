import { t } from '@lingui/macro';

import { SearchBarColumn, SearchBarColumnType } from 'src/components/SearchBar/types';

export function getCensusListSearchBarColumns(): SearchBarColumn[] {
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
            id: 'type',
            searchParam: 'type',
            type: SearchBarColumnType.CHOICE,
            placeholder: t`All types of visits`,
            options: [
                {
                    value: {
                        Coding: {
                            code: 'ltc',
                            system: 'http://example.org/census-visit-type',
                            display: 'LTC',
                        },
                    },
                },
                {
                    value: {
                        Coding: {
                            code: 'hospice',
                            system: 'http://example.org/census-visit-type',
                            display: 'Hospice',
                        },
                    },
                },
                {
                    value: {
                        Coding: {
                            code: 'skilled',
                            system: 'http://example.org/census-visit-type',
                            display: 'Skilled',
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
