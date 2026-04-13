import { t, Trans } from '@lingui/macro';
import { Tag, Tooltip, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { Bundle, Condition, Encounter, Location, Patient } from 'fhir/r4b';

import { extractBundleResources, parseFHIRReference } from '@beda.software/fhir-react';

import { questionnaireAction, ResourceListPage } from 'src/uberComponents/ResourceListPage';
import { RecordType, ReportColumn, TableManager } from 'src/uberComponents/ResourceListPage/types';
import { formatHumanDate } from 'src/utils/date';
import { renderHumanName } from 'src/utils/fhir';

import { getCensusListSearchBarColumns } from './searchBarUtils';

const { useToken } = theme;

interface CensusEncounterData {
    patient?: Patient;
    location?: Location;
    conditions: Condition[];
}

function extractCensusData(encounter: Encounter, bundle: Bundle): CensusEncounterData {
    const sourceMap = extractBundleResources(bundle);
    const { Patient: patients = [], Location: locations = [], Condition: conditions = [] } = sourceMap;

    const patient = patients.find(
        (p) => encounter.subject && (p as Patient).id === parseFHIRReference(encounter.subject).id,
    ) as Patient | undefined;

    const locationRef = encounter.location?.[0]?.location;
    const location = locationRef
        ? (locations.find((l) => (l as Location).id === parseFHIRReference(locationRef).id) as Location | undefined)
        : undefined;

    const encounterConditions = (encounter.diagnosis ?? [])
        .map((d) => {
            const ref = d.condition;
            return conditions.find((c) => (c as Condition).id === parseFHIRReference(ref).id) as Condition | undefined;
        })
        .filter((c): c is Condition => c !== undefined);

    return { patient, location, conditions: encounterConditions };
}

function StatusTag({ status }: { status: Encounter['status'] }) {
    const { token } = useToken();

    const statusConfig: Record<string, { color: string; label: string }> = {
        booked: { color: token['orange-6'] ?? '#fa8c16', label: t`Booked` },
        cancelled: { color: token['red-5'] ?? '#ff4d4f', label: t`Cancelled` },
        fulfilled: { color: token['green-6'] ?? '#52c41a', label: t`Fulfilled` },
        'in-progress': { color: token['blue-6'] ?? '#1890ff', label: t`In Progress` },
        finished: { color: token['purple-6'] ?? '#722ed1', label: t`Finished` },
    };

    const config = statusConfig[status] ?? { color: token['grey-6'] ?? '#bfbfbf', label: status };

    return <Tag color={config.color}>{config.label}</Tag>;
}

function getDiagnosisDisplay(conditions: Condition[]): string {
    return conditions
        .flatMap((c) => c.code?.coding ?? [])
        .map((coding) => [coding.code, coding.display].filter(Boolean).join(' '))
        .join(', ');
}

export function CensusList() {
    const getTableColumns = (_manager: TableManager): ColumnsType<RecordType<Encounter>> => [
        {
            title: <Trans>Patient</Trans>,
            dataIndex: 'patient',
            key: 'patient',
            render: (_text: any, record: RecordType<Encounter>) => {
                const { patient } = extractCensusData(record.resource, record.bundle);
                const patientId = patient?.id;
                const name = renderHumanName(patient?.name?.[0]);
                return patientId ? (
                    <a href={`/patients/${patientId}`} style={{ color: '#3366ff' }}>
                        {name}
                    </a>
                ) : (
                    name
                );
            },
        },
        {
            title: <Trans>Birth date</Trans>,
            dataIndex: 'birthDate',
            key: 'birthDate',
            render: (_text: any, record: RecordType<Encounter>) => {
                const { patient } = extractCensusData(record.resource, record.bundle);
                return formatHumanDate(patient?.birthDate);
            },
        },
        {
            title: <Trans>Room</Trans>,
            dataIndex: 'room',
            key: 'room',
            render: (_text: any, record: RecordType<Encounter>) => {
                const { location } = extractCensusData(record.resource, record.bundle);
                return location?.name ?? '';
            },
        },
        {
            title: <Trans>DX</Trans>,
            dataIndex: 'dx',
            key: 'dx',
            render: (_text: any, record: RecordType<Encounter>) => {
                const { conditions } = extractCensusData(record.resource, record.bundle);
                return getDiagnosisDisplay(conditions);
            },
        },
        {
            title: <Trans>CPT</Trans>,
            dataIndex: 'cpt',
            key: 'cpt',
            render: (_text: any, record: RecordType<Encounter>) => {
                const typeCoding = record.resource.type
                    ?.flatMap((t) => t.coding ?? [])
                    .filter((c) => c.system?.includes('cpt') || c.system?.includes('procedure'))
                    .map((c) => c.code)
                    .filter(Boolean)
                    .join(', ');
                return typeCoding ?? '';
            },
        },
        {
            title: <Trans>Type of Care</Trans>,
            dataIndex: 'typeOfCare',
            key: 'typeOfCare',
            render: (_text: any, record: RecordType<Encounter>) => {
                const serviceType = record.resource.serviceType?.coding
                    ?.map((c) => c.display ?? c.code)
                    .filter(Boolean)
                    .join(', ');
                return serviceType ?? '';
            },
        },
        {
            title: <Trans>Code</Trans>,
            dataIndex: 'code',
            key: 'code',
            render: (_text: any, record: RecordType<Encounter>) => {
                const priority = record.resource.priority?.coding
                    ?.map((c) => c.display ?? c.code)
                    .filter(Boolean)
                    .join(', ');
                return priority ?? '';
            },
        },
        {
            title: <Trans>Chief Complaint</Trans>,
            dataIndex: 'chiefComplaint',
            key: 'chiefComplaint',
            ellipsis: { showTitle: false },
            render: (_text: any, record: RecordType<Encounter>) => {
                const complaints = record.resource.reasonCode
                    ?.map((rc) => rc.text ?? rc.coding?.[0]?.display)
                    .filter(Boolean)
                    .join('; ');
                return complaints ? (
                    <Tooltip title={complaints}>
                        <span>{complaints}</span>
                    </Tooltip>
                ) : null;
            },
        },
        {
            title: <Trans>Status</Trans>,
            dataIndex: 'status',
            key: 'status',
            render: (_text: any, record: RecordType<Encounter>) => <StatusTag status={record.resource.status} />,
        },
    ];

    const getRecordActions = (record: RecordType<Encounter>, _manager: TableManager) => [
        questionnaireAction(<Trans>Update Status</Trans>, 'census-update-status'),
        questionnaireAction(<Trans>Add note</Trans>, 'census-add-note'),
    ];

    const getHeaderActions = () => [questionnaireAction(<Trans>Add Patient to Census</Trans>, 'census-add-patient')];

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

    const getReportColumns = (bundle: Bundle): ReportColumn[] => [
        {
            title: <Trans>Total Number of Patients</Trans>,
            value: bundle.total ?? 0,
        },
    ];

    return (
        <ResourceListPage<Encounter>
            headerTitle={t`Census`}
            resourceType="Encounter"
            searchParams={{
                '_include:iterate': ['Encounter:subject', 'Encounter:location', 'Encounter:diagnosis:Condition'],
                _sort: '-_lastUpdated,_id',
                _count: 13,
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
