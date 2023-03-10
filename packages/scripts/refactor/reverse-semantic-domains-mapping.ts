import { semanticDomains } from '@living-dictionaries/site';

export function reverse_semantic_domains_mapping(semantic_domains: string[]): string[] {
  const cleaned_semantic_domains = replace_hyphen_with_comma(semantic_domains);
  const semantic_domain_number = cleaned_semantic_domains.map((semantic_domain) => {
    const domain = update_old_semantic_domains(semantic_domain);
    const matched_domain_obj = semanticDomains.find((sd) => sd.name === domain);
    return matched_domain_obj?.key || semantic_domain;
  });
  return semantic_domain_number;
}

if (import.meta.vitest) {
  describe('reverse_semantic_domains_mapping', () => {
    test('converts normal domain strings', () => {
      const sdn = ['Universe and the natural world', 'Earth, geology and landscape'];
      const expected = ['1', '1.2']
      expect(reverse_semantic_domains_mapping(sdn)).toEqual(expected);
    });

    test('converts domains with hyphens', () => {
      const sdn = ['Health - well-being and sickness', 'Earth - geology and landscape'];
      const expected = ['2.4', '1.2'];
      expect(reverse_semantic_domains_mapping(sdn)).toEqual(expected);
    });

    test('ignores when strings are already the semantic domain keys', () => {
      const sdn = ['2.4', '1.2'];
      const expected = ['2.4', '1.2'];
      expect(reverse_semantic_domains_mapping(sdn)).toEqual(expected);
    });

    test('checks the renamed semantic domains are updated', () => {
      const sdn = ['States', 'Physical Actions and States'];
      const expected = ['6.5', '6'];
      expect(reverse_semantic_domains_mapping(sdn)).toEqual(expected);
    });
  });
}

function replace_hyphen_with_comma(strings: string[]): string[] {
  return strings.map((s) => s.replace(/ -/g, ','));
}

if (import.meta.vitest) {
  describe('replace_hyphen_with_comma', () => {
    test('changes space plus hyphen into comma', () => {
      const strings = [
        'Health - well-being and sickness',
        'Coordinators - Subordinators - Relativizers - Quotatives',
      ];
      expect(replace_hyphen_with_comma(strings)).toEqual([
        'Health, well-being and sickness',
        'Coordinators, Subordinators, Relativizers, Quotatives',
      ]);
    });

    test('ignores hyphens without space', () => {
      const semantic_domains = [
        'Pro-forms',
        'Motion',
      ];
      expect(replace_hyphen_with_comma(semantic_domains)).toEqual([
        'Pro-forms',
        'Motion',
      ]);
    });
  })
}

function update_old_semantic_domains(semantic_domain: string): string {
  if (semantic_domain === 'States') {
    return 'States and Characteristics';
  } else if (semantic_domain === 'Physical Actions and States') {
    return 'Physical Actions';
  }
  return semantic_domain;
}


