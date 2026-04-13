import { PlusOutlined } from '@ant-design/icons';
import { t, Trans } from '@lingui/macro';
import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { Bundle, Encounter, Patient, Practitioner, PractitionerRole } from 'fhir/r4b';

import { extractBundleResources, parseFHIRReference } from '@beda.software/fhir-react';

import { SearchBarColumn, SearchBarColumnType } from 'src/components/SearchBar/types';
import { ResourceListPage, questionnaireAction } from 'src/uberComponents/ResourceListPage';
import { RecordType, TableManager } from 'src/uberComponents/ResourceListPage/types';
import { formatHumanDate } from 'src/utils/date';
import { renderHumanName } from 'src/utils/fhir';

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

const statusColorMap: Record<string, string> = {
    planned: 'green',
    'in-progress': 'orange',
    finished: 'blue',
    cancelled: 'red',
};

const statusDisplayMap: Record<string, string> = {
    planned: 'Booked',
    'in-progress': 'In Progress',
    finished: 'Fulfilled',
    cancelled: 'Cancelled',
};

function CensusStatusBadge({ status }: { status: string }) {
    return <Tag color={statusColorMap[status] ?? 'default'}>{statusDisplayMap[status] ?? status}</Tag>;
}

function getCensusFilters(): SearchBarColumn[] {
    return [
        {
            id: 'patient',
            type: SearchBarColumnType.REFERENCE,
            placeholder: t`All facilities`,
            expression: 'Location',
            path: 'name',
        },
        {
            id: 'practitioner',
            type: SearchBarColumnType.REFERENCE,
            placeholder: t`All practitioners`,
            expression: 'PractitionerRole?_assoc=practitioner',
            path: "practitioner.resource.name.given.first() + ' ' + practitioner.resource.name.family",
        },
        {
            id: 'class',
            searchParam: 'class',
            type: SearchBarColumnType.CHOICE,
            placeholder: t`All types of visits`,
            options: [
                {
                    value: {
                        Coding: {
                            code: 'consultation',
                            system: 'http://fhir.org/guides/argonaut-scheduling/CodeSystem/visit-type',
                            display: 'Consultation',
                        },
                    },
                },
                {
                    value: {
                        Coding: {
                            code: 'follow-up',
                            system: 'http://fhir.org/guides/argonaut-scheduling/CodeSystem/visit-type',
                            display: 'Follow-up',
                        },
                    },
                },
            ],
        },
        {
            id: 'date',
            type: SearchBarColumnType.DATE,
            placeholder: [t`Start date`, t`End date`],
        },
    ];
}

export function CensusList() {
    const getTableColumns = (_manager: TableManager): ColumnsType<RecordType<Encounter>> => [
        {
            title: <Trans>Patient</Trans>,
            dataIndex: 'patient',
            key: 'patient',
            render: (_text, record) => {
                const { patient } = extractCensusData(record.resource, record.bundle);
                return renderHumanName(patient?.name?.[0]);
            },
            width: 200,
        },
        {
            title: <Trans>Birth date</Trans>,
            dataIndex: 'birthDate',
            key: 'birthDate',
            render: (_text, record) => {
                const { patient } = extractCensusData(record.resource, record.bundle);
                return patient?.birthDate ? formatHumanDate(patient.birthDate) : null;
            },
            width: 110,
        },
        {
            title: <Trans>Room</Trans>,
            dataIndex: 'room',
            key: 'room',
            render: (_text, record) => {
                const location = record.resource.location?.[0]?.location;
                return location ? parseFHIRReference(location).id : null;
            },
            width: 80,
        },
        {
            title: <Trans>DX</Trans>,
            dataIndex: 'dx',
            key: 'dx',
            render: (_text, record) => {
                return record.resource.diagnosis
                    ?.map((d) => d.condition?.display)
                    .filter(Boolean)
                    .join(', ');
            },
            width: 170,
        },
        {
            title: <Trans>CPT</Trans>,
            dataIndex: 'cpt',
            key: 'cpt',
            render: (_text, record) => {
                return record.resource.type
                    ?.flatMap((t) => t.coding?.map((c) => c.code))
                    .filter(Boolean)
                    .join(', ');
            },
            width: 70,
        },
        {
            title: <Trans>Type of Care</Trans>,
            dataIndex: 'typeOfCare',
            key: 'typeOfCare',
            render: (_text, record) => {
                return record.resource.class?.display ?? record.resource.class?.code;
            },
            width: 100,
        },
        {
            title: <Trans>Code</Trans>,
            dataIndex: 'code',
            key: 'code',
            render: (_text, record) => {
                return (
                    record.resource.serviceType?.coding?.[0]?.display ?? record.resource.serviceType?.coding?.[0]?.code
                );
            },
            width: 70,
        },
        {
            title: <Trans>Chief Complaint</Trans>,
            dataIndex: 'chiefComplaint',
            key: 'chiefComplaint',
            render: (_text, record) => {
                return record.resource.reasonCode
                    ?.map((r) => r.text ?? r.coding?.[0]?.display)
                    .filter(Boolean)
                    .join(', ');
            },
            width: 200,
        },
        {
            title: <Trans>Status</Trans>,
            dataIndex: 'status',
            key: 'status',
            render: (_text, record) => <CensusStatusBadge status={record.resource.status} />,
            width: 90,
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

    const getFilters = () => getCensusFilters();

    const getReportColumns = (bundle: Bundle) => {
        const total = bundle.total ?? 0;
        return [
            {
                title: t`Total Number of Patients`,
                value: total,
            },
        ];
    };

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
                _sort: '-date,_id',
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
