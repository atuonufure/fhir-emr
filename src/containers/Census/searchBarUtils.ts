import { t } from '@lingui/macro';

import { SearchBarColumn, SearchBarColumnType } from 'src/components/SearchBar/types';

export function getCensusSearchBarColumns(): SearchBarColumn[] {
    return [
        {
            id: 'location',
            type: SearchBarColumnType.REFERENCE,
            placeholder: t`All facilities`,
            expression: 'Location',
            path: 'name',
        },
        {
            id: 'practitioner',
            type: SearchBarColumnType.REFERENCE,
            placeholder: t`All practitioners`,
            expression: 'Practitioner',
            path: "name.given.first() + ' ' + name.family",
        },
        {
            id: 'type',
            type: SearchBarColumnType.STRING,
            placeholder: t`All types of visits`,
        },
        {
            id: 'date',
            type: SearchBarColumnType.DATE,
            placeholder: [t`Start date`, t`End date`],
        },
    ];
}
