import OpenAI from 'openai';
import { Reading, Verdict } from './types';

export class OpenAIService {
  private openai: OpenAI;

  constructor(endpoint: string, apiKey: string, deploymentName: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
      baseURL: `${endpoint}/openai/deployments/${deploymentName}`,
      defaultQuery: { 'api-version': '2024-02-15-preview' },
      defaultHeaders: {
        'api-key': apiKey,
      },
    });
  }

  async analyzeWaterReading(reading: Reading): Promise<Verdict> {
    const prompt = this.buildAnalysisPrompt(reading);
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: "", // Model name is not needed for Azure OpenAI deployments
        messages: [
          {
            role: "system",
            content: `You are an expert pool and hot tub water chemistry advisor. You provide safety assessments, dosing recommendations, and educational guidance for water treatment.

CRITICAL SAFETY RULES:
- ALWAYS prioritize safety over convenience
- Flag any reading that makes water unsafe for use
- Provide specific, actionable dosing instructions
- Include proper chemical handling warnings
- Never recommend mixing chemicals directly

Your response must be in JSON format matching the Verdict type structure exactly.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      return JSON.parse(response) as Verdict;
    } catch (error) {
      console.error('OpenAI analysis error:', error);
      // Return fallback verdict
      return this.getFallbackVerdict(reading);
    }
  }

  private buildAnalysisPrompt(reading: Reading): string {
    return `Analyze this ${reading.body} water chemistry reading for a ${reading.audience}:

READINGS:
- Body: ${reading.body}
- Volume: ${reading.volume_gal} gallons  
- Sanitizer: ${reading.sanitizer}
- Input Mode: ${reading.input_mode || 'numeric'}

CHEMISTRY VALUES:
${this.formatChemistryValues(reading)}

CONDITIONS:
- Visible Issues: ${reading.visible_issues.join(', ') || 'none'}
- Recent Actions: ${reading.recent_actions.join(', ') || 'none'}
- Temperature: ${reading.temp_f || 'unknown'}°F
- Region: ${reading.region || 'unknown'}

Provide a complete safety assessment with:
1. Safety status (safe/caution/not_safe) and clear reasons
2. Primary issues and secondary risks
3. Step-by-step action plan with specific dosages
4. Target ranges for this setup
5. Educational tips and follow-up guidance
6. Input validation with confidence score

Format as JSON matching the Verdict type structure.`;
  }

  private formatChemistryValues(reading: Reading): string {
    const values: string[] = [];
    
    if (reading.input_mode === 'strip' && reading.strip) {
      const s = reading.strip;
      if (reading.sanitizer === 'bromine') {
        values.push(`- Bromine (strip): ${s.br || 'unknown'}`);
      } else {
        values.push(`- Free Chlorine (strip): ${s.fc || 'unknown'}`);
      }
      values.push(`- Combined Chlorine (strip): ${s.cc || 'unknown'}`);
      values.push(`- pH (strip): ${s.ph || 'unknown'}`);
      values.push(`- Total Alkalinity (strip): ${s.ta || 'unknown'}`);
      values.push(`- Calcium Hardness (strip): ${s.ch || 'unknown'}`);
      values.push(`- Cyanuric Acid (strip): ${s.cya || 'unknown'}`);
      if (s.salt) values.push(`- Salt (strip): ${s.salt}`);
    } else {
      if (reading.sanitizer === 'bromine') {
        values.push(`- Bromine: ${reading.br ?? 'unknown'} ppm`);
      } else {
        values.push(`- Free Chlorine: ${reading.fc ?? 'unknown'} ppm`);
      }
      values.push(`- Combined Chlorine: ${reading.cc ?? 'unknown'} ppm`);
      values.push(`- pH: ${reading.ph ?? 'unknown'}`);
      values.push(`- Total Alkalinity: ${reading.ta ?? 'unknown'} ppm`);
      values.push(`- Calcium Hardness: ${reading.ch ?? 'unknown'} ppm`);
      values.push(`- Cyanuric Acid: ${reading.cya ?? 'unknown'} ppm`);
      if (reading.salt_ppm !== null) {
        values.push(`- Salt: ${reading.salt_ppm ?? 'unknown'} ppm`);
      }
    }
    
    return values.join('\n');
  }

  private getFallbackVerdict(reading: Reading): Verdict {
    return {
      safety: {
        status: "caution",
        reasons: ["Unable to analyze with AI service - using basic safety check"]
      },
      diagnosis: {
        primary_issues: ["Service unavailable"],
        secondary_risks: ["Manual testing recommended"]
      },
      action_plan: [{
        step: 1,
        action: "Retest water chemistry manually and consult local pool professional",
        order_of_operations: "Verify all readings before adding chemicals",
        retest_after_minutes: 60
      }],
      targets: reading.body === "hot_tub" ? {
        "Sanitizer": "3-5 ppm",
        "pH": "7.4-7.6", 
        "TA": "50-80 ppm",
        "CH": "150-250 ppm"
      } : {
        "FC": "1-3 ppm",
        "pH": "7.4-7.6",
        "TA": "60-90 ppm", 
        "CH": "200-400 ppm",
        "CYA": "30-50 ppm"
      },
      education: {
        quick_tips: ["Always add chemicals one at a time", "Keep pump running when adding chemicals"],
        notes: ["Service temporarily unavailable - manual testing recommended"]
      },
      follow_up: {
        retest_checklist: ["All parameters"],
        when: "After 1 hour circulation",
        what_to_log: ["Before/after readings"]
      },
      validator: {
        flags: ["Service unavailable - using fallback analysis"],
        severity: "warn",
        confidence: 0.3
      },
      disclaimers: [
        "This is a fallback analysis due to service issues",
        "Consult pool professional for accurate assessment"
      ]
    };
  }
}