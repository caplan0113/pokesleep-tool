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

export default function PartyCalcApp() {
  const [teamSerials, setTeamSerials] = useState<(string | null)[]>(() => {
    const saved = localStorage.getItem('PstPartySelection');
    try {
      return saved ? JSON.parse(saved) : [null, null, null, null, null];
    } catch {
      return [null, null, null, null, null];
    }
  });

  const [params, setParams] = useState<StrengthParameter>(() => loadStrengthParameter());
  const [tabValue, setTabValue] = useState(0);
  const [energyDialogOpen, setEnergyDialogOpen] = useState(false);

  const handleClearAll = useCallback(() => {
    if (window.confirm("パーティをリセットしますか？")) {
      const empty = [null, null, null, null, null];
      setTeamSerials(empty);
      localStorage.setItem('PstPartySelection', JSON.stringify(empty));
    }
  }, []);

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

  const defaultIV = getInitialIvState().pokemonIv;
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

    // 3. 各スロットの個別計算（idx を削除して ESLint エラーを回避）
    return members.map((m) => {
      if (!m) return null;
      const { iv, nickname } = m;
      
      const isOwnerHB = iv.hasHelpingBonusInActiveSubSkills;
      const applicableHbCount = isOwnerHB ? Math.max(0, totalHbCount - 1) : totalHbCount;

      const currentCalcParams = createStrengthParameter({
        ...params,
        addHelpingBonusEffect: false,
        helpBonusCount: Math.min(applicableHbCount, 4) as 0 | 1 | 2 | 3 | 4,
        totalFlags: [true, false, true], // 材料無効
      });
      
      try {
        return { 
          iv, 
          nickname: nickname || iv.pokemonName,
          result: new PokemonStrength(iv, currentCalcParams).calculate() 
        };
      } catch {
        return null;
      }
    });
  }, [teamSerials, params]);

  const handleSelectFromBox = useCallback((fullSerial: string) => {
    setTeamSerials((prev) => {
      const emptyIndex = prev.findIndex(s => !s);
      if (emptyIndex === -1) {
        // alert("パーティがいっぱいです。");
        return prev;
      }
      const newTeam = [...prev];
      newTeam[emptyIndex] = fullSerial;
      localStorage.setItem('PstPartySelection', JSON.stringify(newTeam));
      return newTeam;
    });
  }, []);

  const handleRemoveMember = useCallback((idx: number) => {
    setTeamSerials((prev) => {
      const newTeam = [...prev];
      newTeam[idx] = null;
      localStorage.setItem('PstPartySelection', JSON.stringify(newTeam));
      return newTeam;
    });
  }, []);

  return (
    <Box sx={{ p: 2, pb: 15 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>パーティ編成</Typography>
        <Button size="small" variant="text" color="error" onClick={handleClearAll}>全解除</Button>
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