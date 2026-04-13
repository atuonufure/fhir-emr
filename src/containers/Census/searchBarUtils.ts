import { t } from '@lingui/macro';

import { SearchBarColumn, SearchBarColumnType } from 'src/components/SearchBar/types';

export function getCensusSearchBarColumns(): SearchBarColumn[] {
    return [
        {
            id: 'location-organization',
            searchParam: 'location.organization',
            type: SearchBarColumnType.REFERENCE,
            placeholder: t`All facilities`,
            expression: 'Organization',
            path: 'name',
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
                { value: { Coding: { code: 'LTC', display: 'LTC' } } },
                { value: { Coding: { code: 'hospice', display: 'Hospice' } } },
                { value: { Coding: { code: 'skilled', display: 'Skilled' } } },
            ],
        },
        {
            id: 'date',
            type: SearchBarColumnType.DATE,
            placeholder: [t`Start date`, t`End date`],
        },
    ];
}
