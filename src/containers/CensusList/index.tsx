import { PlusOutlined } from '@ant-design/icons';
import { t, Trans } from '@lingui/macro';
import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { Bundle, Encounter, Patient } from 'fhir/r4b';

import { extractBundleResources, parseFHIRReference } from '@beda.software/fhir-react';

import { SearchBarColumn, SearchBarColumnType } from 'src/components/SearchBar/types';
import { ResourceListPage, questionnaireAction } from 'src/uberComponents/ResourceListPage';
import { RecordType, ReportColumn, TableManager } from 'src/uberComponents/ResourceListPage/types';
import { formatHumanDate } from 'src/utils/date';
import { renderHumanName } from 'src/utils/fhir';
import { matchCurrentUserRole, Role } from 'src/utils/role';

function getPatientFromEncounter(encounter: Encounter, bundle: Bundle): Patient | undefined {
    if (!encounter.subject) {
        return undefined;
    }
    const patientId = parseFHIRReference(encounter.subject).id;
    const sourceMap = extractBundleResources(bundle);
    const patients = (sourceMap.Patient ?? []) as Patient[];
    return patients.find((p) => p.id === patientId);
}

function CensusStatusTag({ status }: { status: string }) {
    const colorMap: Record<string, string> = {
        booked: 'green',
        cancelled: 'red',
        fulfilled: 'blue',
        'in-progress': 'orange',
        finished: 'purple',
    };

    const labelMap: Record<string, string> = {
        booked: t`Booked`,
        cancelled: t`Cancelled`,
        fulfilled: t`Fulfilled`,
        'in-progress': t`In Progress`,
        finished: t`Finished`,
    };

    return <Tag color={colorMap[status] ?? 'default'}>{labelMap[status] ?? status}</Tag>;
}

function getFilters(): SearchBarColumn[] {
    return [
        {
            id: 'location',
            type: SearchBarColumnType.REFERENCE,
            placeholder: t`All facilities`,
            expression: 'Location',
            path: 'name',
            searchParam: 'location',
        },
        {
            id: 'practitioner',
            type: SearchBarColumnType.REFERENCE,
            placeholder: t`All practitioners`,
            expression: 'Practitioner',
            path: "name.given.first() + ' ' + name.family",
            searchParam: 'participant',
        },
        {
            id: 'type',
            type: SearchBarColumnType.CHOICE,
            placeholder: t`All types of visits`,
            searchParam: 'type',
            options: [
                { value: { Coding: { code: 'LTC', display: t`LTC` } } },
                { value: { Coding: { code: 'skilled', display: t`Skilled` } } },
                { value: { Coding: { code: 'hospice', display: t`Hospice` } } },
            ],
        },
        {
            id: 'date',
            type: SearchBarColumnType.DATE,
            placeholder: [t`Start date`, t`End date`],
            searchParam: 'date',
        },
    ];
}

function getTableColumns(_manager: TableManager): ColumnsType<RecordType<Encounter>> {
    return [
        {
            title: <Trans>Patient</Trans>,
            dataIndex: 'patient',
            key: 'patient',
            render: (_text: any, record: RecordType<Encounter>) => {
                const patient = getPatientFromEncounter(record.resource, record.bundle);
                const name = patient?.name?.[0];
                return (
                    <a href={`/patients/${patient?.id}`} style={{ color: '#3366ff' }}>
                        {renderHumanName(name)}
                    </a>
                );
            },
        },
        {
            title: <Trans>Birth date</Trans>,
            dataIndex: 'birthDate',
            key: 'birthDate',
            render: (_text: any, record: RecordType<Encounter>) => {
                const patient = getPatientFromEncounter(record.resource, record.bundle);
                return patient?.birthDate ? formatHumanDate(patient.birthDate) : null;
            },
        },
        {
            title: <Trans>Room</Trans>,
            dataIndex: 'room',
            key: 'room',
            render: (_text: any, record: RecordType<Encounter>) => {
                const location = record.resource.location?.[0];
                return location?.location?.display ?? null;
            },
        },
        {
            title: <Trans>DX</Trans>,
            dataIndex: 'dx',
            key: 'dx',
            render: (_text: any, record: RecordType<Encounter>) => {
                const diagnoses = record.resource.diagnosis ?? [];
                return diagnoses
                    .map((d) => d.condition?.display)
                    .filter(Boolean)
                    .join(', ');
            },
        },
        {
            title: <Trans>CPT</Trans>,
            dataIndex: 'cpt',
            key: 'cpt',
            render: (_text: any, record: RecordType<Encounter>) => {
                const serviceType = record.resource.serviceType;
                return serviceType?.coding?.[0]?.code ?? null;
            },
        },
        {
            title: <Trans>Type of Care</Trans>,
            dataIndex: 'typeOfCare',
            key: 'typeOfCare',
            render: (_text: any, record: RecordType<Encounter>) => {
                const type = record.resource.type?.[0];
                return type?.coding?.[0]?.display ?? type?.text ?? null;
            },
        },
        {
            title: <Trans>Code</Trans>,
            dataIndex: 'code',
            key: 'code',
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
                const reasons = record.resource.reasonCode ?? [];
                return reasons
                    .map((r) => r.text ?? r.coding?.[0]?.display)
                    .filter(Boolean)
                    .join(', ');
            },
        },
        {
            title: <Trans>Status</Trans>,
            dataIndex: 'status',
            key: 'status',
            render: (_text: any, record: RecordType<Encounter>) => {
                return <CensusStatusTag status={record.resource.status} />;
            },
        },
    ];
}

function getReportColumns(bundle: Bundle): ReportColumn[] {
    return [
        {
            title: <Trans>Total Number of Patients</Trans>,
            value: bundle.total ?? 0,
        },
    ];
}

export function CensusList() {
    const roleSearchParams = matchCurrentUserRole({
        [Role.Admin]: () => ({}),
        [Role.Practitioner]: (practitioner) => ({ participant: practitioner.id }),
        [Role.Receptionist]: () => ({}),
        [Role.Patient]: () => ({}),
    });

    const getHeaderActions = () => [
        questionnaireAction(<Trans>Add Patient to Census</Trans>, 'census-patient-add', {
            icon: <PlusOutlined />,
        }),
    ];

    const getRecordActions = (record: RecordType<Encounter>, _manager: TableManager) => [
        questionnaireAction(<Trans>Update Status</Trans>, 'census-status-update'),
        questionnaireAction(<Trans>Add note</Trans>, 'census-note-add'),
    ];

    return (
        <ResourceListPage<Encounter>
            headerTitle={t`Census`}
            resourceType="Encounter"
            searchParams={{
                ...roleSearchParams,
                _include: ['Encounter:subject'],
                _sort: '-_lastUpdated,_id',
                _count: 13,
            }}
            getFilters={getFilters}
            getTableColumns={getTableColumns}
            getRecordActions={getRecordActions}
            getHeaderActions={getHeaderActions}
            getReportColumns={getReportColumns}
        />
    );
}
