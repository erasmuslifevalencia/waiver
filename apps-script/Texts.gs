/**
 * Waiver texts (ES = binding version, EN = translation).
 * DRAFT – to be validated by a lawyer / the insurer before use.
 * version: 'CON' (insurance bought with us) | 'SIN' (no insurance)
 */
function waiverText_(version, lang, insurances) {
  const ins = (insurances || []).join(' + ');
  const C = CONFIG;

  if (lang === 'es') {
    const p = [
      'Yo, la persona participante identificada en este documento, inscrita en el viaje "' + C.TRIP_ES + '" del ' +
        C.TRIP_DATES + ', organizado por ' + C.ORGANIZER + ', bajo el nombre comercial ' + C.BRAND +
        ' (en adelante, "la Organización"), declaro lo siguiente:',
      '1. Riesgos. He sido informado/a de que el viaje incluye actividades con riesgos inherentes, en particular las ' +
        'actividades opcionales en el desierto de Merzouga (paseo en camello, excursión en 4x4, quad y buggy), los ' +
        'trayectos largos por carretera y las actividades al aire libre. Acepto dichos riesgos de forma voluntaria.',
      '2. Instrucciones. Me comprometo a seguir en todo momento las instrucciones de los guías, monitores y proveedores, ' +
        'a utilizar el equipo de seguridad facilitado y a respetar los horarios y normas del grupo.',
      '3. Conducta. Asumo la responsabilidad de los daños que pueda sufrir o causar a terceros, a los alojamientos, ' +
        'vehículos u otros bienes como consecuencia de mi propia conducta imprudente, del incumplimiento de las ' +
        'instrucciones recibidas o del consumo de alcohol o drogas. Me comprometo a respetar la legislación y las ' +
        'costumbres de Marruecos. La Organización podrá excluir del viaje, sin derecho a reembolso, a cualquier ' +
        'participante cuyo comportamiento ponga en peligro su seguridad o la de los demás o perturbe gravemente el viaje.',
      '4. Salud. Declaro encontrarme en condiciones de salud física y mental adecuadas para participar en el viaje y en ' +
        'las actividades elegidas, y no estar bajo los efectos del alcohol ni de drogas. Si tomo medicación o tengo ' +
        'alguna condición médica relevante, he consultado a un médico y he informado a la Organización de lo necesario ' +
        'para mi seguridad.',
      '5. Documentación. Soy responsable de viajar con un pasaporte válido y con los documentos exigidos para entrar ' +
        'en Marruecos y regresar a España.',
      version === 'CON'
        ? '6. Seguro. He contratado a través de la Organización el seguro de viaje ' + C.INSURER + ' (' + ins + '). ' +
          'Entiendo que la cobertura se rige exclusivamente por las condiciones de la póliza, que puedo solicitar a la ' +
          'Organización, y que los gastos no cubiertos por la póliza corren de mi cuenta.'
        : '6. Seguro. La Organización me ha ofrecido un seguro de viaje internacional de la compañía ' + C.INSURER +
          ' y he decidido no contratarlo. Sé que la Tarjeta Sanitaria Europea no es válida en Marruecos y que, en caso ' +
          'de enfermedad, accidente, hospitalización, repatriación, pérdida de equipaje o cancelación, todos los gastos ' +
          'correrán de mi cuenta o de mi propio seguro, si lo tengo.',
      '7. Derechos. Esta declaración no limita los derechos que me reconoce la normativa sobre viajes combinados ni la ' +
        'responsabilidad de la Organización en los casos en que la ley no permite excluirla.',
      '8. Idioma. Este documento se presenta en español y en inglés. En caso de discrepancia, prevalece la versión española.',
      '9. Protección de datos. Responsable: HOME TRIP & SERVICES S.L. Finalidad: gestionar mi participación en el viaje y ' +
        'conservar prueba de esta declaración. Base jurídica: ejecución del contrato de viaje e interés legítimo. ' +
        'Conservación: el tiempo necesario para atender posibles reclamaciones. Puedo ejercer mis derechos de acceso, ' +
        'rectificación, supresión, oposición y demás escribiendo a ' + C.PRIVACY_EMAIL + '.',
      '10. Firma. Firmo electrónicamente este documento marcando la casilla de aceptación, escribiendo mi nombre completo ' +
        'y dibujando mi firma.',
    ];
    return {
      title: 'DESCARGO DE RESPONSABILIDAD Y ACEPTACIÓN DE RIESGOS – ' +
        (version === 'CON' ? 'CON SEGURO DE VIAJE CONTRATADO' : 'SIN SEGURO DE VIAJE CONTRATADO'),
      paragraphs: p,
    };
  }

  const p = [
    'I, the participant identified in this document, registered for the "' + C.TRIP_EN + '" (' + C.TRIP_DATES +
      '), organised by ' + C.ORGANIZER_EN + ', under the trade name ' + C.BRAND + ' (the "Organiser"), declare the following:',
    '1. Risks. I have been informed that the trip includes activities with inherent risks, in particular the optional ' +
      'activities in the Merzouga desert (camel ride, 4x4 tour, quad and buggy), long road journeys and outdoor ' +
      'activities. I voluntarily accept these risks.',
    '2. Instructions. I will follow the instructions of the guides, instructors and providers at all times, use the ' +
      'safety equipment provided and respect the group schedule and rules.',
    '3. Conduct. I am responsible for any damage I suffer or cause to third parties, accommodation, vehicles or other ' +
      'property as a result of my own reckless behaviour, failure to follow instructions or use of alcohol or drugs. ' +
      'I will respect the laws and customs of Morocco. The Organiser may exclude from the trip, without refund, any ' +
      'participant whose behaviour endangers their own safety or that of others or seriously disrupts the trip.',
    '4. Health. I declare that my physical and mental health is suitable for the trip and the activities I chose, and ' +
      'that I am not under the influence of alcohol or drugs. If I take medication or have a relevant medical ' +
      'condition, I have consulted a doctor and informed the Organiser of what is necessary for my safety.',
    '5. Documents. I am responsible for travelling with a valid passport and the documents required to enter Morocco ' +
      'and return to Spain.',
    version === 'CON'
      ? '6. Insurance. I have purchased through the Organiser the ' + C.INSURER + ' travel insurance (' + ins + '). ' +
        'I understand that coverage is governed exclusively by the policy conditions, which I can request from the ' +
        'Organiser, and that any costs not covered by the policy are my own responsibility.'
      : '6. Insurance. The Organiser offered me international travel insurance from ' + C.INSURER + ' and I chose not ' +
        'to buy it. I know that the European Health Insurance Card is NOT valid in Morocco and that, in case of illness, ' +
        'accident, hospitalisation, repatriation, lost luggage or cancellation, all costs will be paid by me or by my ' +
        'own insurance, if I have one.',
    '7. Rights. This declaration does not limit my rights under package travel law, nor the Organiser\'s liability ' +
      'where the law does not allow it to be excluded.',
    '8. Language. This document is provided in Spanish and English. In case of discrepancy, the Spanish version prevails.',
    '9. Data protection. Controller: HOME TRIP & SERVICES S.L. Purpose: managing my participation in the trip and ' +
      'keeping proof of this declaration. Legal basis: performance of the travel contract and legitimate interest. ' +
      'Retention: as long as needed to handle possible claims. I can exercise my rights of access, rectification, ' +
      'erasure, objection and others by writing to ' + C.PRIVACY_EMAIL + '.',
    '10. Signature. I sign this document electronically by ticking the acceptance box, typing my full name and ' +
      'drawing my signature.',
  ];
  return {
    title: 'LIABILITY WAIVER AND ACCEPTANCE OF RISK – ' +
      (version === 'CON' ? 'WITH TRAVEL INSURANCE' : 'WITHOUT TRAVEL INSURANCE'),
    paragraphs: p,
  };
}
