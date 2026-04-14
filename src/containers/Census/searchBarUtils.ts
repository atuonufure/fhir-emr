import { t } from '@lingui/macro';

import { SearchBarColumn, SearchBarColumnType } from 'src/components/SearchBar/types';

export function getCensusSearchBarColumns(): SearchBarColumn[] {
    return [
        {
            id: 'patient',
            type: SearchBarColumnType.REFERENCE,
            placeholder: t`Search by patient`,
            expression: 'Patient',
            path: "name.given.first() + ' ' + name.family",
        },
        {
            id: 'practitioner',
            searchParam: 'participant-display',
            type: SearchBarColumnType.STRING,
            placeholder: t`Search by practitioner`,
        },
        {
            id: 'status',
            type: SearchBarColumnType.CHOICE,
            placeholder: t`Filter by status`,
            searchParam: 'status',
            options: [
                {
                    value: {
                        Coding: {
                            code: 'planned',
                            display: 'Booked',
                            system: 'http://hl7.org/fhir/encounter-status',
                        },
                    },
                },
                {
                    value: {
                        Coding: {
                            code: 'finished',
                            display: 'Fulfilled',
                            system: 'http://hl7.org/fhir/encounter-status',
                        },
                    },
                },
                {
                    value: {
                        Coding: {
                            code: 'cancelled',
                            display: 'Cancelled',
                            system: 'http://hl7.org/fhir/encounter-status',
                        },
                    },
                },
            ],
        },
    ];
}
