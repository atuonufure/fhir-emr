import { PlusOutlined } from '@ant-design/icons';
import { t, Trans } from '@lingui/macro';
import { Tag, Tooltip, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { Bundle, Condition, Encounter, Location, Patient, Practitioner, PractitionerRole } from 'fhir/r4b';

import { extractBundleResources, parseFHIRReference } from '@beda.software/fhir-react';

import { ResourceListPage, navigationAction, questionnaireAction } from 'src/uberComponents/ResourceListPage';
import { RecordType, ReportColumn, TableManager } from 'src/uberComponents/ResourceListPage/types';
import { formatHumanDate } from 'src/utils/date';
import { renderHumanName } from 'src/utils/fhir';
import { matchCurrentUserRole, Role } from 'src/utils/role';

import { getCensusSearchBarColumns } from './searchBarUtils';

const { useToken } = theme;

interface CensusEncounterData {
    patient?: Patient;
    practitioner?: Practitioner;
    location?: Location;
    conditions: Condition[];
}

function extractCensusData(encounter: Encounter, bundle: Bundle): CensusEncounterData {
    const sourceMap = extractBundleResources(bundle);
    const {
        Patient: patients = [],
        Practitioner: practitioners = [],
        PractitionerRole: practitionerRoles = [],
        Location: locations = [],
        Condition: conditions = [],
    } = sourceMap;

    const patient = patients.find(
        (p) => encounter.subject && (p as Patient).id === parseFHIRReference(encounter.subject).id,
    ) as Patient | undefined;

    let practitioner: Practitioner | undefined;
    const individualReference = encounter.participant?.[0]?.individual;
    if (individualReference) {
        const refType = parseFHIRReference(individualReference).resourceType;
        if (refType === 'PractitionerRole') {
            const role = (practitionerRoles as PractitionerRole[]).find(
                (pr) => pr.id === parseFHIRReference(individualReference).id,
            );
            if (role?.practitioner) {
                practitioner = (practitioners as Practitioner[]).find(
                    (p) => p.id === parseFHIRReference(role.practitioner!).id,
                );
            }
        } else if (refType === 'Practitioner') {
            practitioner = (practitioners as Practitioner[]).find(
                (p) => p.id === parseFHIRReference(individualReference).id,
            );
        }
    }

    const location = encounter.location?.[0]?.location
        ? (locations as Location[]).find((l) => l.id === parseFHIRReference(encounter.location![0]!.location).id)
        : undefined;

    const encounterConditions = (encounter.diagnosis ?? [])
        .map((d) => {
            const condRef = d.condition;
            return (conditions as Condition[]).find((c) => c.id === parseFHIRReference(condRef).id);
        })
        .filter((c): c is Condition => c !== undefined);

    return { patient, practitioner, location, conditions: encounterConditions };
}

function getDiagnosisCodes(conditions: Condition[]): string {
    return conditions
        .flatMap((c) => c.code?.coding ?? [])
        .map((coding) => coding.code)
        .filter(Boolean)
        .join(', ');
}

function getTypeOfCare(encounter: Encounter): string {
    const type = encounter.type?.[0]?.coding?.[0];
    return type?.display ?? type?.code ?? '';
}

function getEncounterCode(encounter: Encounter): string {
    return encounter.priority?.coding?.[0]?.display ?? encounter.priority?.coding?.[0]?.code ?? '';
}

function getChiefComplaint(encounter: Encounter): string {
    return encounter.reasonCode?.[0]?.text ?? encounter.reasonCode?.[0]?.coding?.[0]?.display ?? '';
}

function getCptCode(encounter: Encounter): string {
    const serviceType = encounter.serviceType?.coding?.[0];
    return serviceType?.code ?? '';
}

function CensusStatusTag({ status }: { status: Encounter['status'] }) {
    const { token } = useToken();

    const statusConfig: Record<string, { color: string; label: string }> = {
        planned: { color: token['blue-6'], label: t`Planned` },
        arrived: { color: token['cyan-6'], label: t`Arrived` },
        triaged: { color: token['purple-6'], label: t`Triaged` },
        'in-progress': { color: token['blue-6'], label: t`In Progress` },
        onleave: { color: token['gold-6'], label: t`On Leave` },
        finished: { color: token['green-6'], label: t`Fulfilled` },
        cancelled: { color: token['red-5'], label: t`Cancelled` },
        'entered-in-error': { color: token['red-5'], label: t`Error` },
        unknown: { color: token['grey-6'] ?? '#999', label: t`Unknown` },
    };

    const config = statusConfig[status] ?? { color: token['orange-6'], label: status };

    return (
        <Tag color={config.color} style={{ borderRadius: 4, color: 'white', border: 'none' }}>
            {config.label}
        </Tag>
    );
}

export function Census() {
    const roleSearchParams = matchCurrentUserRole({
        [Role.Admin]: () => ({}),
        [Role.Practitioner]: (practitioner) => ({ participant: practitioner.id }),
        [Role.Patient]: () => ({}),
        [Role.Receptionist]: () => ({}),
    });

    const getFilters = () => getCensusSearchBarColumns();

    const getReportColumns = (bundle: Bundle): ReportColumn[] => [
        {
            title: t`Total Number of Patients`,
            value: bundle.total ?? 0,
        },
    ];

    const getTableColumns = (_manager: TableManager): ColumnsType<RecordType<Encounter>> => [
        {
            title: <Trans>Patient</Trans>,
            dataIndex: 'patient',
            key: 'patient',
            width: '15%',
            render: (_text: any, record: RecordType<Encounter>) => {
                const { patient } = extractCensusData(record.resource, record.bundle);
                const name = renderHumanName(patient?.name?.[0]);
                return (
                    <a
                        href={`/patients/${patient?.id}`}
                        onClick={(e) => {
                            e.preventDefault();
                            window.location.href = `/patients/${patient?.id}`;
                        }}
                    >
                        {name}
                    </a>
                );
            },
        },
        {
            title: <Trans>Birth date</Trans>,
            dataIndex: 'birthDate',
            key: 'birthDate',
            width: '8%',
            render: (_text: any, record: RecordType<Encounter>) => {
                const { patient } = extractCensusData(record.resource, record.bundle);
                return patient?.birthDate ? formatHumanDate(patient.birthDate) : null;
            },
        },
        {
            title: <Trans>Room</Trans>,
            dataIndex: 'room',
            key: 'room',
            width: '6%',
            render: (_text: any, record: RecordType<Encounter>) => {
                const { location } = extractCensusData(record.resource, record.bundle);
                return location?.name ?? record.resource.location?.[0]?.location?.display ?? '';
            },
        },
        {
            title: <Trans>DX</Trans>,
            dataIndex: 'dx',
            key: 'dx',
            width: '13%',
            render: (_text: any, record: RecordType<Encounter>) => {
                const { conditions } = extractCensusData(record.resource, record.bundle);
                return getDiagnosisCodes(conditions);
            },
        },
        {
            title: <Trans>CPT</Trans>,
            dataIndex: 'cpt',
            key: 'cpt',
            width: '5%',
            render: (_text: any, record: RecordType<Encounter>) => getCptCode(record.resource),
        },
        {
            title: <Trans>Type of Care</Trans>,
            dataIndex: 'typeOfCare',
            key: 'typeOfCare',
            width: '6%',
            render: (_text: any, record: RecordType<Encounter>) => getTypeOfCare(record.resource),
        },
        {
            title: <Trans>Code</Trans>,
            dataIndex: 'code',
            key: 'code',
            width: '5%',
            render: (_text: any, record: RecordType<Encounter>) => getEncounterCode(record.resource),
        },
        {
            title: <Trans>Chief Complaint</Trans>,
            dataIndex: 'chiefComplaint',
            key: 'chiefComplaint',
            width: '16%',
            ellipsis: true,
            render: (_text: any, record: RecordType<Encounter>) => {
                const complaint = getChiefComplaint(record.resource);
                if (!complaint) {
                    return null;
                }
                return (
                    <Tooltip title={complaint}>
                        <span>{complaint}</span>
                    </Tooltip>
                );
            },
        },
        {
            title: <Trans>Status</Trans>,
            dataIndex: 'status',
            key: 'status',
            width: '7%',
            render: (_text: any, record: RecordType<Encounter>) => <CensusStatusTag status={record.resource.status} />,
        },
    ];

    const getRecordActions = (record: RecordType<Encounter>, _manager: TableManager) => {
        const { patient } = extractCensusData(record.resource, record.bundle);
        return [
            questionnaireAction(<Trans>Update Status</Trans>, 'census-update-status'),
            questionnaireAction(<Trans>Add note</Trans>, 'census-add-note'),
            navigationAction(<Trans>Open</Trans>, `/patients/${patient?.id}/encounters/${record.resource.id}`),
        ];
    };

    const getHeaderActions = () => [
        questionnaireAction(<Trans>Add Patient to Census</Trans>, 'census-patient-add', {
            icon: <PlusOutlined />,
        }),
    ];

    const getSorters = () => [
        {
            id: 'date',
            searchParam: 'date',
            label: 'Date',
        },
    ];

    return (
        <ResourceListPage<Encounter>
            headerTitle={t`Census`}
            resourceType="Encounter"
            searchParams={{
                ...roleSearchParams,
                '_include:iterate': [
                    'Encounter:subject',
                    'Encounter:participant:PractitionerRole',
                    'Encounter:participant:Practitioner',
                    'PractitionerRole:practitioner:Practitioner',
                    'Encounter:location',
                    'Encounter:diagnosis',
                ],
                _sort: '-date,_id',
                _count: 15,
            }}
            getFilters={getFilters}
            getTableColumns={getTableColumns}
            getRecordActions={getRecordActions}
            getHeaderActions={getHeaderActions}
            getSorters={getSorters}
            getReportColumns={getReportColumns}
        />
    );
}
