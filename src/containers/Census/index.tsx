import { PlusOutlined } from '@ant-design/icons';
import { t, Trans } from '@lingui/macro';
import { Tag, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { Bundle, Encounter, Patient } from 'fhir/r4b';

import { extractBundleResources, parseFHIRReference } from '@beda.software/fhir-react';

import { ResourceListPage, navigationAction, questionnaireAction } from 'src/uberComponents/ResourceListPage';
import { RecordType, ReportColumn, TableManager } from 'src/uberComponents/ResourceListPage/types';
import { compileAsFirst } from 'src/utils';
import { formatHumanDate } from 'src/utils/date';
import { renderHumanName } from 'src/utils/fhir';

import { getCensusSearchBarColumns } from './searchBarUtils';

const { useToken } = theme;

const getPatientName = compileAsFirst<Patient, { given?: string[]; family?: string }>('Patient.name.first()');
const getBirthDate = compileAsFirst<Patient, string>('Patient.birthDate');

function getEncounterPatient(encounter: Encounter, bundle: Bundle): Patient | undefined {
    const sourceMap = extractBundleResources(bundle);
    const patients = sourceMap.Patient ?? [];

    return (patients as Patient[]).find(
        (patient) => encounter.subject && patient.id === parseFHIRReference(encounter.subject).id,
    );
}

interface CensusStatusBadgeProps {
    status: Encounter['status'];
}

function CensusStatusBadge({ status }: CensusStatusBadgeProps) {
    const { token } = useToken();

    const statusLabels: Record<string, string> = {
        booked: t`Booked`,
        cancelled: t`Cancelled`,
        fulfilled: t`Fulfilled`,
        'in-progress': t`In Progress`,
        finished: t`Finished`,
        arrived: t`Arrived`,
        planned: t`Planned`,
    };

    const statusColors: Record<string, string> = {
        booked: token['orange-6'],
        cancelled: token['red-5'],
        fulfilled: token['green-6'],
        'in-progress': token['blue-6'],
        finished: token['purple-6'],
        arrived: token['cyan-6'],
        planned: token['geekblue-6'],
    };

    return <Tag color={statusColors[status]}>{statusLabels[status] ?? status}</Tag>;
}

export function Census() {
    const getTableColumns = (_manager: TableManager): ColumnsType<RecordType<Encounter>> => [
        {
            title: <Trans>Patient</Trans>,
            dataIndex: 'patient',
            key: 'patient',
            render: (_text: any, record: RecordType<Encounter>) => {
                const patient = getEncounterPatient(record.resource, record.bundle);
                const name = patient ? getPatientName(patient) : undefined;
                return renderHumanName(name);
            },
        },
        {
            title: <Trans>Birth date</Trans>,
            dataIndex: 'birthDate',
            key: 'birthDate',
            render: (_text: any, record: RecordType<Encounter>) => {
                const patient = getEncounterPatient(record.resource, record.bundle);
                const birthDate = patient ? getBirthDate(patient) : undefined;
                return birthDate ? formatHumanDate(birthDate) : null;
            },
        },
        {
            title: <Trans>Room</Trans>,
            dataIndex: 'room',
            key: 'room',
            render: (_text: any, record: RecordType<Encounter>) => {
                return record.resource.location?.[0]?.location?.display ?? '-';
            },
        },
        {
            title: <Trans>DX</Trans>,
            dataIndex: 'dx',
            key: 'dx',
            render: (_text: any, record: RecordType<Encounter>) => {
                const diagnoses = record.resource.diagnosis ?? [];
                return (
                    diagnoses
                        .map((d) => d.condition?.display)
                        .filter(Boolean)
                        .join(', ') || '-'
                );
            },
        },
        {
            title: <Trans>CPT</Trans>,
            dataIndex: 'cpt',
            key: 'cpt',
            render: (_text: any, record: RecordType<Encounter>) => {
                const types = record.resource.type ?? [];
                return (
                    types
                        .map((t) => t.coding?.[0]?.code)
                        .filter(Boolean)
                        .join(', ') || '-'
                );
            },
        },
        {
            title: <Trans>Type of Care</Trans>,
            dataIndex: 'typeOfCare',
            key: 'typeOfCare',
            render: (_text: any, record: RecordType<Encounter>) => {
                return record.resource.class?.display ?? record.resource.class?.code ?? '-';
            },
        },
        {
            title: <Trans>Code</Trans>,
            dataIndex: 'code',
            key: 'code',
            render: (_text: any, record: RecordType<Encounter>) => {
                return record.resource.priority?.coding?.[0]?.display ?? '-';
            },
        },
        {
            title: <Trans>Chief Complaint</Trans>,
            dataIndex: 'chiefComplaint',
            key: 'chiefComplaint',
            render: (_text: any, record: RecordType<Encounter>) => {
                const reasons = record.resource.reasonCode ?? [];
                return (
                    reasons
                        .map((r) => r.text ?? r.coding?.[0]?.display)
                        .filter(Boolean)
                        .join(', ') || '-'
                );
            },
            ellipsis: true,
        },
        {
            title: <Trans>Status</Trans>,
            dataIndex: 'status',
            key: 'status',
            render: (_text: any, record: RecordType<Encounter>) => (
                <CensusStatusBadge status={record.resource.status} />
            ),
        },
    ];

    const getRecordActions = (record: RecordType<Encounter>, _manager: TableManager) => {
        const patient = getEncounterPatient(record.resource, record.bundle);
        return [
            questionnaireAction(<Trans>Update Status</Trans>, 'census-update-status'),
            navigationAction(<Trans>Add note</Trans>, `/patients/${patient?.id}/encounters/${record.resource.id}`),
        ];
    };

    const getHeaderActions = () => [
        questionnaireAction(<Trans>Add Patient to Census</Trans>, 'census-add-patient', {
            icon: <PlusOutlined />,
        }),
    ];

    const getFilters = () => getCensusSearchBarColumns();

    const getReportColumns = (bundle: Bundle): ReportColumn[] => [
        {
            title: t`Total Number of Patients`,
            value: bundle.total ?? 0,
        },
    ];

    return (
        <ResourceListPage<Encounter>
            headerTitle={t`Census`}
            resourceType="Encounter"
            searchParams={{
                '_include:iterate': [
                    'Encounter:subject',
                    'Encounter:participant:PractitionerRole',
                    'Encounter:participant:Practitioner',
                    'PractitionerRole:practitioner:Practitioner',
                ],
                _sort: '-_lastUpdated,_id',
                _count: 13,
            }}
            getTableColumns={getTableColumns}
            getRecordActions={getRecordActions}
            getHeaderActions={getHeaderActions}
            getFilters={getFilters}
            getReportColumns={getReportColumns}
        />
    );
}
