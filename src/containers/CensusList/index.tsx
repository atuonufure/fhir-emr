import { PlusOutlined } from '@ant-design/icons';
import { t, Trans } from '@lingui/macro';
import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { Bundle, Encounter, Patient, Practitioner, PractitionerRole } from 'fhir/r4b';

import { extractBundleResources, parseFHIRReference } from '@beda.software/fhir-react';

import { SearchBarColumn, SearchBarColumnType } from 'src/components/SearchBar/types';
import { ResourceListPage, questionnaireAction } from 'src/uberComponents/ResourceListPage';
import { RecordType, ReportColumn, TableManager } from 'src/uberComponents/ResourceListPage/types';
import { compileAsFirst, compileAsArray } from 'src/utils';
import { formatHumanDate } from 'src/utils/date';
import { renderHumanName } from 'src/utils/fhir';

const getBirthDate = compileAsFirst<Patient, string>('Patient.birthDate');

const getEncounterDiagnosis = compileAsArray<Encounter, string>('Encounter.diagnosis.condition.display');

const getEncounterReasonDisplay = compileAsFirst<Encounter, string>('Encounter.reasonCode.first().text');

const getEncounterLocation = compileAsFirst<Encounter, string>('Encounter.location.first().location.display');

const getEncounterType = compileAsFirst<Encounter, string>('Encounter.type.first().coding.first().display');

const getEncounterClass = compileAsFirst<Encounter, string>('Encounter.class.display');

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

    const practitionerRole = practitionerRoles.find((pr) => {
        const participant = encounter.participant?.[0];
        if (!participant?.individual) {
            return false;
        }
        return (pr as PractitionerRole).id === parseFHIRReference(participant.individual).id;
    }) as PractitionerRole | undefined;

    const practitioner = practitionerRole?.practitioner
        ? (practitioners.find((p) => p.id === parseFHIRReference(practitionerRole.practitioner!).id) as
              | Practitioner
              | undefined)
        : undefined;

    return { patient, practitioner };
}

function getStatusColor(status: string): string {
    switch (status) {
        case 'planned':
            return 'green';
        case 'finished':
            return 'orange';
        case 'cancelled':
            return 'red';
        default:
            return 'default';
    }
}

function getStatusLabel(status: string): string {
    switch (status) {
        case 'planned':
            return t`Booked`;
        case 'finished':
            return t`Fulfilled`;
        case 'cancelled':
            return t`Cancelled`;
        default:
            return status;
    }
}

function getFilters(): SearchBarColumn[] {
    return [
        {
            id: 'patient',
            type: SearchBarColumnType.REFERENCE,
            placeholder: t`All patients`,
            expression: 'Patient',
            path: "name.given.first() + ' ' + name.family",
        },
        {
            id: 'practitioner',
            searchParam: 'participant',
            type: SearchBarColumnType.REFERENCE,
            placeholder: t`All practitioners`,
            expression: 'Practitioner',
            path: "name.given.first() + ' ' + name.family",
        },
        {
            id: 'date',
            type: SearchBarColumnType.DATE,
            placeholder: [t`Start date`, t`End date`],
        },
        {
            id: 'status',
            type: SearchBarColumnType.CHOICE,
            placeholder: t`All statuses`,
            placement: ['search-bar', 'table'],
            options: [
                { value: { Coding: { code: 'planned', display: t`Booked` } } },
                { value: { Coding: { code: 'finished', display: t`Fulfilled` } } },
                { value: { Coding: { code: 'cancelled', display: t`Cancelled` } } },
            ],
        },
    ];
}

function getHeaderActions() {
    return [
        questionnaireAction(<Trans>Add Patient to Census</Trans>, 'census-patient-add', {
            icon: <PlusOutlined />,
        }),
    ];
}

function getReportColumns(bundle: Bundle): ReportColumn[] {
    const patients = extractBundleResources(bundle).Patient ?? [];
    return [
        {
            title: <Trans>Total Number of Patients</Trans>,
            value: patients.length,
        },
    ];
}

export function CensusList() {
    const getTableColumns = (_manager: TableManager): ColumnsType<RecordType<Encounter>> => [
        {
            title: <Trans>Patient</Trans>,
            dataIndex: 'patient',
            key: 'patient',
            render: (_text: any, record: RecordType<Encounter>) => {
                const { patient } = extractCensusData(record.resource, record.bundle);
                return patient ? renderHumanName(patient.name?.[0]) : null;
            },
        },
        {
            title: <Trans>Birth date</Trans>,
            dataIndex: 'birthDate',
            key: 'birthDate',
            render: (_text: any, record: RecordType<Encounter>) => {
                const { patient } = extractCensusData(record.resource, record.bundle);
                const birthDate = patient ? getBirthDate(patient) : undefined;
                return birthDate ? formatHumanDate(birthDate) : null;
            },
        },
        {
            title: <Trans>Room</Trans>,
            dataIndex: 'room',
            key: 'room',
            render: (_text: any, record: RecordType<Encounter>) => {
                return getEncounterLocation(record.resource);
            },
        },
        {
            title: <Trans>DX</Trans>,
            dataIndex: 'dx',
            key: 'dx',
            render: (_text: any, record: RecordType<Encounter>) => {
                const diagnoses = getEncounterDiagnosis(record.resource);
                return diagnoses.join(', ');
            },
        },
        {
            title: <Trans>CPT</Trans>,
            dataIndex: 'cpt',
            key: 'cpt',
            render: (_text: any, record: RecordType<Encounter>) => {
                return record.resource.type?.[0]?.coding?.find((c) => c.system === 'http://www.ama-assn.org/go/cpt')
                    ?.code;
            },
        },
        {
            title: <Trans>Type of Care</Trans>,
            dataIndex: 'typeOfCare',
            key: 'typeOfCare',
            render: (_text: any, record: RecordType<Encounter>) => {
                return getEncounterClass(record.resource);
            },
        },
        {
            title: <Trans>Code</Trans>,
            dataIndex: 'code',
            key: 'code',
            render: (_text: any, record: RecordType<Encounter>) => {
                return getEncounterType(record.resource);
            },
        },
        {
            title: <Trans>Chief Complaint</Trans>,
            dataIndex: 'chiefComplaint',
            key: 'chiefComplaint',
            render: (_text: any, record: RecordType<Encounter>) => {
                return getEncounterReasonDisplay(record.resource);
            },
            ellipsis: true,
        },
        {
            title: <Trans>Status</Trans>,
            dataIndex: 'status',
            key: 'status',
            render: (_text: any, record: RecordType<Encounter>) => {
                const status = record.resource.status;
                return <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>;
            },
        },
    ];

    const getRecordActions = (record: RecordType<Encounter>, _manager: TableManager) => {
        return [
            questionnaireAction(<Trans>Update Status</Trans>, 'census-update-status'),
            questionnaireAction(<Trans>Add note</Trans>, 'census-add-note'),
        ];
    };

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
            getFilters={getFilters}
            getTableColumns={getTableColumns}
            getRecordActions={getRecordActions}
            getHeaderActions={getHeaderActions}
            getSorters={getSorters}
            getReportColumns={getReportColumns}
        />
    );
}
