import React from 'react';
import { Paper, Box, Typography, Divider, ToggleButton } from '@mui/material';
import PokemonStrength, { StrengthResult } from '../../util/PokemonStrength';
import { formatWithComma } from '../../util/NumberUtil';
import { useTranslation } from 'react-i18next';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import PokemonIv from '../../util/PokemonIv';
import IngredientIcon from '../IvCalc/IngredientIcon';
import { IngredientName } from '../../data/pokemons';
import { StrengthParameter } from '../../util/PokemonStrength';
import { useMemo, memo } from 'react';
import EnergyDialog from '../IvCalc/Strength/EnergyDialog';
import { IvAction } from '../IvCalc/IvState';

interface TeamSummaryProps {
  teamData: ({ iv: PokemonIv; nickname: string; result: StrengthResult; skillStrength: number; skillIngTotal: Record<string, number> | null; param: StrengthParameter; editFlag: boolean; isEvoluved: boolean} | null)[];
  pokemonIv: PokemonIv,
  settings: StrengthParameter,
  energyDialogOpen: boolean,
  dispatch: React.Dispatch<IvAction>,
}

const TeamSummary = memo(({ teamData, pokemonIv, settings, energyDialogOpen, dispatch }: TeamSummaryProps) => {
  const { t } = useTranslation();

  const result = new PokemonStrength(pokemonIv, settings).calculate();

  const [NCFlag, setNCFlag] = React.useState(
    () => {
      const nightCapFlag = localStorage.getItem("partyCalc_nightCapFlag") === "true";
      return nightCapFlag;
    }
  );
  
  const toggleNCFlag = () => {
    setNCFlag((prev) => {
      localStorage.setItem("partyCalc_nightCapFlag", (!prev).toString());
      return !prev;
    });
  };

  const totals = useMemo(() => {
    const pikachuIv = new PokemonIv({ pokemonName: "Pikachu", level: 20 });
    const pikachuStrength = new PokemonStrength(pikachuIv, settings);
    const pikachuResult = pikachuStrength.calculate();
    const NC_HelpCount = (settings.period > 0 && NCFlag) ? (settings.period / (3540/3600)): 0;
    const NC_BerryStrength = Math.ceil(pikachuResult.berryStrength*pikachuStrength.berryStrengthBonus) * 2 * 0.583 * NC_HelpCount;
    const NC_IngredientPerHelp = {
      "apple": 0.2083,
      "cacao": 0.125,
      "honey": 0.0833
    }
    const NC_Ingredient = Object.entries(NC_IngredientPerHelp).reduce((acc, [name, val]) => {
      acc[name as IngredientName] = val * 2 * NC_HelpCount;
      return acc;
    }, {} as Record<IngredientName, number>);

    const teamTotals = teamData.reduce((acc, data) => {
      if (!data) return acc;
      acc.total += data.result.totalStrength;
      acc.berry += data.result.berryTotalStrength;
      acc.ingredientEnergy += data.result.ingStrength;
      acc.skill += data.skillStrength;

      data.result.ingredients.forEach((ing) => {
        if (ing.name !== "unknown") {
          acc.ingCounts[ing.name] = (acc.ingCounts[ing.name] || 0) + ing.count;
        }
      });

      if (data.skillIngTotal != null) {
        Object.entries(data.skillIngTotal).forEach(([name, count]) => {
          acc.ingCounts[name as IngredientName] = (acc.ingCounts[name as IngredientName] || 0) + count;
        });
      }
      return acc;
    }, { total: 0, berry: 0, ingredientEnergy: 0, skill: 0, ingCounts: {} as Record<IngredientName, number> });
    
    teamTotals.total += NC_BerryStrength;
    teamTotals.berry += NC_BerryStrength;
    Object.entries(NC_Ingredient).forEach(([name, count]) => {
      teamTotals.ingCounts[name as IngredientName] = (teamTotals.ingCounts[name as IngredientName] || 0) + count;
    });

    return teamTotals;
  }, [teamData, NCFlag, settings]);

  const sortedIngredients = useMemo(() => {
    return (Object.entries(totals.ingCounts) as [IngredientName, number][])
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a);
  }, [totals.ingCounts]);

  return (
    <>
    <Paper sx={{ p: 2, bgcolor: '#fdfdfd', borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <LocalFireDepartmentIcon sx={{ color: "#ff944b", mr: 1 }} />
        <Typography variant="h6" fontWeight="bold">
          {t('team total (Not Ingredient)')}: {formatWithComma(Math.floor(totals.total))}
        </Typography>
        <ToggleButton
          value="nightCap"
          color="primary"
          selected={NCFlag}
          onChange={toggleNCFlag}
          sx={{ ml: 'auto', fontSize: '0.75rem', py: 0.5, px: 1, borderRadius: 2 }}
        >
          ナイトキャップピカチュウ
        </ToggleButton>
      </Box>

      

      <Box sx={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', mb: 1.5 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">{t('berry')}</Typography>
          <Typography variant="body2" fontWeight="bold">{formatWithComma(Math.floor(totals.berry))}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">{t('ingredient')}</Typography>
          <Typography variant="body2" fontWeight="bold">{formatWithComma(Math.floor(totals.ingredientEnergy))}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">{t('skill')}</Typography>
          <Typography variant="body2" fontWeight="bold">{formatWithComma(Math.floor(totals.skill))}</Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 1.5 }} />

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {t('expected daily ingredients')}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {sortedIngredients.map(([name, count]) => (
          <Box key={name} sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            bgcolor: '#f5f5f5', 
            pl: 0.5, 
            pr: 1, 
            py: 0.2, 
            borderRadius: '12px', 
            border: '1px solid #eee' 
          }}>
            <Box sx={{ 
              width: 22, 
              height: 22, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              '& svg': { width: '100%', height: '100%' } 
            }}>
              <IngredientIcon name={name} />
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 'bold', ml: 0.5 }}>
              {count.toFixed(1)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
    <EnergyDialog
            open={energyDialogOpen}
            iv={pokemonIv}
            parameter={settings}
            energy={result.energy}
            onClose={() => dispatch({ type: "closeEnergyDialog" })}
            dispatch={dispatch}
          />
    </>
  );
});

export default TeamSummary;