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

import { getCensusListSearchBarColumns } from './searchBarUtils';

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

    let practitioner: Practitioner | undefined;
    const individualRef = encounter.participant?.[0]?.individual;
    if (individualRef) {
        const refType = parseFHIRReference(individualRef).resourceType;
        if (refType === 'PractitionerRole') {
            const role = (practitionerRoles as PractitionerRole[]).find(
                (pr) => pr.id === parseFHIRReference(individualRef).id,
            );
            if (role?.practitioner) {
                practitioner = (practitioners as Practitioner[]).find(
                    (p) => p.id === parseFHIRReference(role.practitioner!).id,
                );
            }
        } else if (refType === 'Practitioner') {
            practitioner = (practitioners as Practitioner[]).find((p) => p.id === parseFHIRReference(individualRef).id);
        }
    }

    return { patient, practitioner };
}

const statusColorMap: Record<string, string> = {
    planned: 'red',
    arrived: 'blue',
    triaged: 'orange',
    'in-progress': 'green',
    onleave: 'gold',
    finished: 'purple',
    cancelled: 'default',
};

const statusDisplayMap: Record<string, string> = {
    planned: 'Booked',
    arrived: 'Arrived',
    triaged: 'Triaged',
    'in-progress': 'Current',
    onleave: 'On Leave',
    finished: 'Fulfilled',
    cancelled: 'Cancelled',
};

function CensusStatusTag({ status }: { status: string }) {
    return <Tag color={statusColorMap[status] ?? 'default'}>{statusDisplayMap[status] ?? status}</Tag>;
}

export function CensusList() {
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
            render: (_text: any, record: RecordType<Encounter>) => {
                const { patient } = extractCensusData(record.resource, record.bundle);
                return renderHumanName(patient?.name?.[0]);
            },
        },
        {
            title: <Trans>Birth date</Trans>,
            dataIndex: 'birthDate',
            key: 'birthDate',
            width: 120,
            render: (_text: any, record: RecordType<Encounter>) => {
                const { patient } = extractCensusData(record.resource, record.bundle);
                return patient?.birthDate ? formatHumanDate(patient.birthDate) : null;
            },
        },
        {
            title: <Trans>Room</Trans>,
            dataIndex: 'room',
            key: 'room',
            width: 80,
            render: (_text: any, record: RecordType<Encounter>) => {
                return record.resource.location?.[0]?.location?.display ?? null;
            },
        },
        {
            title: <Trans>DX</Trans>,
            dataIndex: 'dx',
            key: 'dx',
            width: 170,
            render: (_text: any, record: RecordType<Encounter>) => {
                const diagCodes = record.resource.diagnosis?.map((d) => d.condition?.display).filter(Boolean);
                return diagCodes?.join(', ') ?? null;
            },
        },
        {
            title: <Trans>CPT</Trans>,
            dataIndex: 'cpt',
            key: 'cpt',
            width: 70,
            render: (_text: any, record: RecordType<Encounter>) => {
                return record.resource.serviceType?.coding?.[0]?.code ?? null;
            },
        },
        {
            title: <Trans>Type of Care</Trans>,
            dataIndex: 'typeOfCare',
            key: 'typeOfCare',
            width: 110,
            render: (_text: any, record: RecordType<Encounter>) => {
                return record.resource.type?.[0]?.coding?.[0]?.display ?? null;
            },
        },
        {
            title: <Trans>Code</Trans>,
            dataIndex: 'code',
            key: 'code',
            width: 70,
            render: (_text: any, record: RecordType<Encounter>) => {
                return record.resource.priority?.coding?.[0]?.display ?? null;
            },
        },
        {
            title: <Trans>Chief Complaint</Trans>,
            dataIndex: 'chiefComplaint',
            key: 'chiefComplaint',
            ellipsis: true,
            render: (_text: any, record: RecordType<Encounter>) => {
                return (
                    record.resource.reasonCode?.[0]?.text ??
                    record.resource.reasonCode?.[0]?.coding?.[0]?.display ??
                    null
                );
            },
        },
        {
            title: <Trans>Status</Trans>,
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (_text: any, record: RecordType<Encounter>) => <CensusStatusTag status={record.resource.status} />,
        },
    ];

    const getRecordActions = (record: RecordType<Encounter>, _manager: TableManager) => [
        questionnaireAction(<Trans>Update Status</Trans>, 'census-update-status'),
        questionnaireAction(<Trans>Add note</Trans>, 'census-add-note'),
    ];

    const getHeaderActions = () => [
        questionnaireAction(<Trans>Add Patient to Census</Trans>, 'census-add-patient', {
            icon: <PlusOutlined />,
        }),
    ];

    const getFilters = () => getCensusListSearchBarColumns();

    const getSorters = () => [
        {
            id: 'date',
            searchParam: 'date',
            label: t`Date`,
        },
        {
            id: 'status',
            searchParam: 'status',
            label: t`Status`,
        },
    ];

    const getReportColumns = (bundle: Bundle): ReportColumn[] => {
        return [
            {
                title: t`Total Number of Patients`,
                value: bundle.total ?? 0,
            },
        ];
    };

    return (
        <ResourceListPage<Encounter>
            headerTitle={t`Census`}
            resourceType="Encounter"
            searchParams={{
                ...roleSearchParams,
                class: 'IMP',
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
            getSorters={getSorters}
            getReportColumns={getReportColumns}
        />
    );
}
