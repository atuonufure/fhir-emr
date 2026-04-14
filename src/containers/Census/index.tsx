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
import { matchCurrentUserRole, Role } from 'src/utils/role';

import { getCensusSearchBarColumns } from './searchBarUtils';

const encounterStatusColors: Record<string, string> = {
    planned: 'blue',
    'in-progress': 'orange',
    finished: 'green',
    cancelled: 'red',
};

const encounterStatusLabels: Record<string, string> = {
    planned: 'Booked',
    'in-progress': 'In Progress',
    finished: 'Fulfilled',
    cancelled: 'Cancelled',
};

function extractCensusData(encounter: Encounter, bundle: Bundle) {
    const sourceMap = extractBundleResources(bundle);
    const {
        Patient: patients = [],
        Practitioner: practitioners = [],
        PractitionerRole: practitionerRoles = [],
    } = sourceMap;

    const patient = patients.find((p) => encounter.subject && p.id === parseFHIRReference(encounter.subject).id) as
        | Patient
        | undefined;

    const participantRef = encounter.participant?.[0]?.individual;
    let practitioner: Practitioner | undefined;

    if (participantRef) {
        const refType = parseFHIRReference(participantRef).resourceType;
        if (refType === 'PractitionerRole') {
            const role = (practitionerRoles as PractitionerRole[]).find(
                (pr) => pr.id === parseFHIRReference(participantRef).id,
            );
            if (role?.practitioner) {
                practitioner = (practitioners as Practitioner[]).find(
                    (p) => p.id === parseFHIRReference(role.practitioner!).id,
                );
            }
        } else if (refType === 'Practitioner') {
            practitioner = (practitioners as Practitioner[]).find(
                (p) => p.id === parseFHIRReference(participantRef).id,
            );
        }
    }

    return { patient, practitioner };
}

export function Census() {
    const roleSearchParams = matchCurrentUserRole({
        [Role.Admin]: () => ({}),
        [Role.Patient]: () => ({}),
        [Role.Practitioner]: (practitioner) => ({ participant: practitioner.id }),
        [Role.Receptionist]: () => ({}),
    });

    const getTableColumns = (_manager: TableManager): ColumnsType<RecordType<Encounter>> => [
        {
            title: <Trans>Patient</Trans>,
            dataIndex: 'patient',
            key: 'patient',
            render: (_text, record) => {
                const { patient } = extractCensusData(record.resource, record.bundle);
                return renderHumanName(patient?.name?.[0]);
            },
        },
        {
            title: <Trans>Birth date</Trans>,
            dataIndex: 'birthDate',
            key: 'birthDate',
            render: (_text, record) => {
                const { patient } = extractCensusData(record.resource, record.bundle);
                return formatHumanDate(patient?.birthDate);
            },
        },
        {
            title: <Trans>Room</Trans>,
            dataIndex: 'room',
            key: 'room',
            render: (_text, record) => record.resource.location?.[0]?.location?.display ?? '',
        },
        {
            title: <Trans>DX</Trans>,
            dataIndex: 'dx',
            key: 'dx',
            render: (_text, record) => record.resource.diagnosis?.[0]?.condition?.display ?? '',
        },
        {
            title: <Trans>CPT</Trans>,
            dataIndex: 'cpt',
            key: 'cpt',
            render: (_text, record) => record.resource.type?.[0]?.coding?.[0]?.code ?? '',
        },
        {
            title: <Trans>Type of Care</Trans>,
            dataIndex: 'typeOfCare',
            key: 'typeOfCare',
            render: (_text, record) => record.resource.class?.display ?? '',
        },
        {
            title: <Trans>Code</Trans>,
            dataIndex: 'code',
            key: 'code',
            render: (_text, record) => record.resource.class?.code ?? '',
        },
        {
            title: <Trans>Chief Complaint</Trans>,
            dataIndex: 'chiefComplaint',
            key: 'chiefComplaint',
            render: (_text, record) => record.resource.reasonCode?.[0]?.text ?? '',
        },
        {
            title: <Trans>Status</Trans>,
            dataIndex: 'status',
            key: 'status',
            render: (_text, record) => {
                const status = record.resource.status;
                return <Tag color={encounterStatusColors[status]}>{encounterStatusLabels[status] ?? status}</Tag>;
            },
        },
    ];

    const getRecordActions = (record: RecordType<Encounter>, _manager: TableManager) => [
        questionnaireAction(<Trans>Update Status</Trans>, 'census-update-status'),
        questionnaireAction(<Trans>Add Note</Trans>, 'census-add-note'),
    ];

    const getHeaderActions = () => [
        questionnaireAction(<Trans>Add Patient</Trans>, 'census-add-patient', {
            icon: <PlusOutlined />,
        }),
    ];

    const getFilters = () => getCensusSearchBarColumns();

    const getReportColumns = (bundle: Bundle): ReportColumn[] => {
        const encounters = extractBundleResources(bundle).Encounter ?? [];
        return [
            {
                title: <Trans>Total Number of Patients</Trans>,
                value: encounters.length,
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
                    'Encounter:participant:Practitioner',
                    'PractitionerRole:practitioner:Practitioner',
                ],
                _sort: '-date,_id',
                _count: 10,
            }}
            getTableColumns={getTableColumns}
            getRecordActions={getRecordActions}
            getHeaderActions={getHeaderActions}
            getFilters={getFilters}
            getReportColumns={getReportColumns}
        />
    );
}
