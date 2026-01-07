import React, { useState, useMemo, useCallback } from 'react';
import { Box, Tabs, Tab, Typography, Button } from '@mui/material';
import PokemonIv from '../../util/PokemonIv';
import PokemonStrength, { createStrengthParameter, loadStrengthParameter, StrengthParameter } from '../../util/PokemonStrength';
import PartyMemberSlot from './PartyMemberSlot';
import TeamSummary from './TeamSummary';
import PartyBoxList from './PartyBoxList';
import { getInitialIvState, IvAction} from '../IvCalc/IvState';
import StrengthParameterForm from '../IvCalc/Strength/StrengthParameterForm';
import EnergyDialog from '../IvCalc/Strength/EnergyDialog';
import {PokemonType} from '../../data/pokemons';
import { IngredientName } from '../../data/pokemons';
import { getSkillValue } from '../../util/MainSkill'

const defaultIV = getInitialIvState().pokemonIv.changeLevel(1);

export default function PartyCalcApp() {
  // 1. パーティ全体のデータを管理 (5セット分)
  const [allTeams, setAllTeams] = useState<(string | null)[][]>(() => {
    const saved = localStorage.getItem('PstPartySelectionGroups');
    try {
      // 5セット分の配列を初期化
      return saved ? JSON.parse(saved) : Array(5).fill(null).map(() => [null, null, null, null, null]);
    } catch {
      return Array(5).fill(null).map(() => [null, null, null, null, null]);
    }
  });

  // 2. 現在表示中のパーティ番号 (0~4)
  const [currentTeamIndex, setCurrentTeamIndex] = useState<number>(() => {
    const savedIdx = localStorage.getItem('PstCurrentTeamIndex');
    return savedIdx ? parseInt(savedIdx, 10) : 0;
  });

  // 現在のパーティを取得
  const teamSerials = allTeams[currentTeamIndex];

  const [params, setParams] = useState<StrengthParameter>(() => loadStrengthParameter());
  const [tabValue, setTabValue] = useState(0);
  const [energyDialogOpen, setEnergyDialogOpen] = useState(false);

  // 3. データを保存する共通関数
  const saveTeams = (newAllTeams: (string | null)[][]) => {
    setAllTeams(newAllTeams);
    localStorage.setItem('PstPartySelectionGroups', JSON.stringify(newAllTeams));
  };

  // 4. パーティ切り替え
  const handleSwitchTeam = (idx: number) => {
    setCurrentTeamIndex(idx);
    localStorage.setItem('PstCurrentTeamIndex', idx.toString());
  };

  const handleClearAll = useCallback(() => {
    if (window.confirm(`パーティ ${currentTeamIndex + 1} をリセットしますか？`)) {
      const newAllTeams = [...allTeams];
      newAllTeams[currentTeamIndex] = [null, null, null, null, null];
      saveTeams(newAllTeams);
    }
  }, [allTeams, currentTeamIndex]);

  const dispatch = useCallback((action: IvAction) => {
    if (action.type === "changeParameter") {
      const newParam = action.payload.parameter;
      setParams(newParam);
      localStorage.setItem('PstStrenghParam', JSON.stringify(newParam));
    }
    if (action.type === "openEnergyDialog") {
        setEnergyDialogOpen(true);
    }
    if (action.type === "closeEnergyDialog") {
        setEnergyDialogOpen(false);
    }
    if (action.type === "changeLowerTab") {
        setTabValue(1);
    }
  }, []);

  const defaultResult = new PokemonStrength(defaultIV, params).calculate();
  
  const teamData = useMemo(() => {
    // 1. 全メンバーを復元（ニックネーム分離）
    const members = teamSerials.map(s => {
      if (!s) return null;
      try {
        const [serial, nickname] = s.split('@');
        const iv = PokemonIv.deserialize(serial);
        return { iv, nickname };
      } catch {
        return null;
      }
    });

    // 2. パーティ内の合計HB数を算出
    const totalHbCount = members.filter(m => m?.iv.hasHelpingBonusInActiveSubSkills).length;
    const teamTypeAndLevel = members.map(m => {
      if (!m) return defaultIV;
      return m.iv;
    });

    const teamSpecies: Record<PokemonType, Set<string>> = members.reduce((acc, m) => {
      if (!m) return acc;
      const name = m.iv.pokemon.name;
      const type = m.iv.pokemon.type;
      if (!acc[type]) acc[type] = new Set<string>();
      acc[type].add(name);
      return acc;
    }, {} as Record<PokemonType, Set<string>>);

    const strengthPerHelpCalcParams = createStrengthParameter({
      ...params,
      addHelpingBonusEffect: false,
      totalFlags: [true, false, true], // 食材無効
      period: -1
    });
    const teamStrengthPerHelp = members.reduce((acc, m) => {
      if (!m) return acc;
      const pokeStrength = new PokemonStrength(m.iv, strengthPerHelpCalcParams).calculate();
      acc.push({berry: pokeStrength.berryTotalStrength, ing: pokeStrength.ingredients});
      return acc;
    }, [] as {berry: number; ing: {name: IngredientName; count: number}[]}[]);

    const teamStrengthPerHelpBerryTotal: number = teamStrengthPerHelp.reduce((acc, val) => {
      return acc + val.berry;
    }, 0);

    // const teamStrengthPerHelpIngTotal: Record<IngredientName, number> = teamStrengthPerHelp.reduce((acc, val) => {
    //   val.ing.forEach(ing => {
    //     if (ing.name === "unknown") return;
    //     acc[ing.name] = (acc[ing.name] || 0) + ing.count;
    //   });
    //   return acc;
    // }, {} as Record<IngredientName, number>);

    // 3. 各スロットの個別計算（idx を削除して ESLint エラーを回避）
    return members.map((m) => {
      if (!m) return null;
      const { iv, nickname } = m;
      
      const isOwnerHB = iv.hasHelpingBonusInActiveSubSkills;
      const applicableHbCount = isOwnerHB ? Math.max(0, totalHbCount - 1) : totalHbCount;

      const berryBurstTeam = teamTypeAndLevel.filter(mm => m.iv != mm).map(mm => ({
        type: mm.pokemon.type,
        level: mm.level
      }));

      const currentCalcParams = createStrengthParameter({
        ...params,
        addHelpingBonusEffect: false,
        helpBonusCount: Math.min(applicableHbCount, 4) as 0 | 1 | 2 | 3 | 4,
        totalFlags: [true, false, true], // 食材無効
        berryBurstTeam: {
          auto: false,
          members: berryBurstTeam,
          species: Math.max(teamSpecies[iv.pokemon.type].size, 1)
        }
      });

      const pokeStrength = new PokemonStrength(iv, currentCalcParams)
      const pokeStrengthCal = pokeStrength.calculate();
      let skillStrength = 0;
      let skillIngTotal;
      if (iv.pokemon.skill.includes("Ingredient Magnet S") ||
          iv.pokemon.skill.includes("Cooking Power-Up S") ||
          iv.pokemon.skill.includes("Ingredient Draw S")
      ){
        skillStrength = 0;
        skillIngTotal = null;
      } else if (iv.pokemon.skill.includes("Helper Boost")) {
        const skillBaseValue = getSkillValue("Helper Boost", pokeStrength.getSkillLevel(), Math.max(teamSpecies[iv.pokemon.type].size, 1));
        skillStrength = skillBaseValue * pokeStrengthCal.skillCount * teamStrengthPerHelpBerryTotal;
        skillIngTotal = teamStrengthPerHelp.reduce((acc, val) => {
          val.ing.forEach(ing => {
            if (ing.name === "unknown") return;
            acc[ing.name] = (acc[ing.name] || 0) + (ing.count * skillBaseValue * pokeStrengthCal.skillCount);
          });
          return acc;
        }, {} as Record<IngredientName, number>);

        // console.log("Helper Boost skillStrength:", skillStrength, skillBaseValue, pokeStrengthCal.skillCount, teamStrengthPerHelpBerryTotal, skillIngTotal);
      } else if (iv.pokemon.skill.includes("Extra Helpful S")) {
        skillStrength = pokeStrengthCal.skillValue * teamStrengthPerHelpBerryTotal / teamStrengthPerHelp.length;
        skillIngTotal = teamStrengthPerHelp.reduce((acc, val) => {
          val.ing.forEach(ing => {
            if (ing.name === "unknown") return;
            acc[ing.name] = (acc[ing.name] || 0) + (ing.count * pokeStrengthCal.skillValue / teamStrengthPerHelp.length);
          });
          return acc;
        }, {} as Record<IngredientName, number>);

        // console.log("Extra Helpful S skillStrength:", skillStrength, pokeStrengthCal.skillValue, teamStrengthPerHelpBerryTotal, teamStrengthPerHelp.length, skillIngTotal);
      } else {
        skillStrength = pokeStrengthCal.skillStrength + pokeStrengthCal.skillStrength2;
        skillIngTotal = null;
      }
      
      try {
        return { 
          iv, 
          nickname: nickname || iv.pokemonName,
          result: pokeStrengthCal,
          skillStrength: skillStrength,
          skillIngTotal: skillIngTotal
        };
      } catch {
        return null;
      }
    });
  }, [teamSerials, params]);

  // handleSelectFromBox などの更新
  const handleSelectFromBox = useCallback((fullSerial: string) => {
    const newAllTeams = [...allTeams];
    const currentTeam = [...newAllTeams[currentTeamIndex]];
    
    const emptyIndex = currentTeam.findIndex(s => !s);
    if (emptyIndex !== -1) {
      currentTeam[emptyIndex] = fullSerial;
      newAllTeams[currentTeamIndex] = currentTeam;
      saveTeams(newAllTeams);
    }
  }, [allTeams, currentTeamIndex]);

  const handleRemoveMember = useCallback((idx: number) => {
    const newAllTeams = [...allTeams];
    const currentTeam = [...newAllTeams[currentTeamIndex]];
    currentTeam[idx] = null;
    newAllTeams[currentTeamIndex] = currentTeam;
    saveTeams(newAllTeams);
  }, [allTeams, currentTeamIndex]);

  return (
    <Box sx={{ p: 2, pb: 15 }}>
      {/* 5. パーティ切り替えUIの追加 */}
      

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>パーティ編成 {currentTeamIndex + 1}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {[0, 1, 2, 3, 4].map((idx) => (
            <Button
              key={idx}
              size="small"
              variant={currentTeamIndex === idx ? "contained" : "outlined"}
              onClick={() => handleSwitchTeam(idx)}
              sx={{ minWidth: 40, p: 0.3
               }}
            >
              {idx + 1}
            </Button>
          ))}
        </Box>
        <Button size="small" variant="text" color="error" onClick={handleClearAll}>このセットを解除</Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        {teamData.map((data, idx) => (
          <Box key={`slot-${idx}-${teamSerials[idx] || 'empty'}`} sx={{ width: '20%', minWidth: 0 }}>
            <PartyMemberSlot member={data} onRemove={() => handleRemoveMember(idx)} />
          </Box>
        ))}
      </Box>

      <TeamSummary teamData={teamData} />

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 4, mb: 2 }}>
        <Tabs value={tabValue} onChange={(_e, v) => setTabValue(v)} variant="fullWidth">
          <Tab label="ポケモン選択" />
          <Tab label="計算条件設定" />
        </Tabs>
      </Box>

      {tabValue === 0 ? (
        <PartyBoxList onSelect={handleSelectFromBox} parameter={params} dispatch={dispatch} />
      ) : (
        <Box sx={{ bgcolor: '#fff', p: 1, borderRadius: 2 }}>
          <StrengthParameterForm 
            dispatch={dispatch} 
            value={params} 
            hasHelpingBonus={teamData.some(d => d?.iv.hasHelpingBonusInActiveSubSkills)} 
          />
          <EnergyDialog
            open={energyDialogOpen}
            iv={defaultIV}
            parameter={params}
            energy={defaultResult.energy}
            onClose={() => dispatch({ type: "closeEnergyDialog" })}
            dispatch={dispatch}
          />
        </Box>
      )}
    </Box>
  );
}