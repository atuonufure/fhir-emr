import { PlusOutlined } from '@ant-design/icons';
import { t, Trans } from '@lingui/macro';
import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { Bundle, Encounter, Patient, Practitioner, PractitionerRole } from 'fhir/r4b';

import { extractBundleResources, parseFHIRReference } from '@beda.software/fhir-react';

import { ResourceListPage, questionnaireAction } from 'src/uberComponents/ResourceListPage';
import { RecordType, ReportColumn, TableManager } from 'src/uberComponents/ResourceListPage/types';
import { formatHumanDate } from 'src/utils/date';
import { renderHumanName } from 'src/utils/fhir';
import { matchCurrentUserRole, Role, selectCurrentUserRoleResource } from 'src/utils/role';

import { getCensusSearchBarColumns } from './searchBarUtils';

function extractEncounterData(encounter: Encounter, bundle: any) {
    const sourceMap = extractBundleResources(bundle);
    const {
        Patient: patients = [],
        Practitioner: practitioners = [],
        PractitionerRole: practitionerRoles = [],
    } = sourceMap;

    const patient = patients.find((p) => encounter.subject && p.id === parseFHIRReference(encounter.subject).id) as
        | Patient
        | undefined;

    const practitionerRole = practitionerRoles.find((pr) => {
        const individual = encounter.participant?.[0]?.individual;
        return individual && (pr as PractitionerRole).id === parseFHIRReference(individual).id;
    }) as PractitionerRole | undefined;

    const practitioner = practitionerRole
        ? (practitioners.find(
              (p) => practitionerRole.practitioner && p.id === parseFHIRReference(practitionerRole.practitioner).id,
          ) as Practitioner | undefined)
        : undefined;

    return { patient, practitioner, practitionerRole };
}

const statusConfig: Record<string, { color: string; label: string }> = {
    planned: { color: 'blue', label: 'Booked' },
    finished: { color: 'green', label: 'Fulfilled' },
    cancelled: { color: 'red', label: 'Cancelled' },
    'in-progress': { color: 'orange', label: 'In Progress' },
};

export function Census() {
    const roleSearchParams = matchCurrentUserRole({
        [Role.Admin]: () => ({}),
        [Role.Patient]: () => ({}),
        [Role.Practitioner]: (practitioner) => ({ participant: practitioner.id }),
        [Role.Receptionist]: () => ({}),
    });

    const author = selectCurrentUserRoleResource();

    const getHeaderActions = () => [
        questionnaireAction(<Trans>Add Patient to Census</Trans>, 'census-add-patient', {
            icon: <PlusOutlined />,
        }),
    ];

    const getRecordActions = (record: RecordType<Encounter>, _manager: TableManager) => [
        questionnaireAction(<Trans>Update Status</Trans>, 'census-update-status'),
        questionnaireAction(<Trans>Add note</Trans>, 'census-add-note'),
    ];

    const getTableColumns = (_manager: TableManager): ColumnsType<RecordType<Encounter>> => [
        {
            title: <Trans>Patient</Trans>,
            dataIndex: 'patient',
            key: 'patient',
            render: (_text: any, record: RecordType<Encounter>) => {
                const { patient } = extractEncounterData(record.resource, record.bundle);
                return renderHumanName(patient?.name?.[0]);
            },
        },
        {
            title: <Trans>Birth date</Trans>,
            dataIndex: 'birthDate',
            key: 'birthDate',
            render: (_text: any, record: RecordType<Encounter>) => {
                const { patient } = extractEncounterData(record.resource, record.bundle);
                return patient?.birthDate ? formatHumanDate(patient.birthDate) : null;
            },
        },
        {
            title: <Trans>Type of Care</Trans>,
            dataIndex: 'class',
            key: 'class',
            render: (_text: any, record: RecordType<Encounter>) => {
                return record.resource.class?.display ?? record.resource.class?.code;
            },
        },
        {
            title: <Trans>Chief Complaint</Trans>,
            dataIndex: 'chiefComplaint',
            key: 'chiefComplaint',
            render: (_text: any, record: RecordType<Encounter>) => {
                const reason = record.resource.reasonCode?.[0];
                return reason?.text ?? reason?.coding?.[0]?.display;
            },
        },
        {
            title: <Trans>Status</Trans>,
            dataIndex: 'status',
            key: 'status',
            render: (_text: any, record: RecordType<Encounter>) => {
                const status = record.resource.status;
                const config = statusConfig[status];
                return config ? <Tag color={config.color}>{config.label}</Tag> : <Tag>{status}</Tag>;
            },
        },
    ];

    const getFilters = () => getCensusSearchBarColumns();

    const getSorters = () => [
        {
            id: 'date',
            searchParam: 'date',
            label: 'Date',
        },
    ];

    const getReportColumns = (bundle: Bundle): ReportColumn[] => {
        const resources = extractBundleResources(bundle);
        const total = bundle.total ?? resources.Encounter?.length ?? 0;

        return [
            {
                title: <Trans>Total Number of Patients</Trans>,
                value: total,
            },
        ];
    };

    return (
        <ResourceListPage
            headerTitle={t`Census`}
            resourceType="Encounter"
            searchParams={{
                ...roleSearchParams,
                '_include:iterate': [
                    'Encounter:subject',
                    'Encounter:participant:PractitionerRole',
                    'PractitionerRole:practitioner:Practitioner',
                ],
                _sort: '-date,_id',
                _count: 13,
            }}
            getTableColumns={getTableColumns}
            getRecordActions={getRecordActions}
            getHeaderActions={getHeaderActions}
            getFilters={getFilters}
            getSorters={getSorters}
            getReportColumns={getReportColumns}
            defaultLaunchContext={[{ name: 'Author', resource: author }]}
        />
    );
}
