import React, { useState, useMemo, useCallback } from 'react';
import { Box, Tabs, Tab, Typography, Button, Paper } from '@mui/material';
import PokemonIv from '../../util/PokemonIv';
import PokemonStrength, { createStrengthParameter, loadStrengthParameter, StrengthParameter } from '../../util/PokemonStrength';
import PartyMemberSlot from './PartyMemberSlot';
import TeamSummary from './TeamSummary';
// import PartyBoxList from './PartyBoxList';
import { getInitialIvState, IvAction} from '../IvCalc/IvState';
import StrengthParameterForm from '../IvCalc/Strength/StrengthParameterForm';
import EnergyDialog from '../IvCalc/Strength/EnergyDialog';
// import {PokemonType} from '../../data/pokemons';
// import { IngredientName } from '../../data/pokemons';
import { getSkillValue } from '../../util/MainSkill'
import BoxItemDialog from '../IvCalc/Box/BoxItemDialog';
import { PokemonBoxItem } from '../../util/PokemonBox';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { IconButton } from '@mui/material';
import StrengthBerryIngSkillView  from '../IvCalc/Strength/StrengthBerryIngSkillView';
// import { useTranslation } from 'react-i18next';
import PokemonBox from '../../util/PokemonBox';
import BoxView from '../IvCalc/Box/BoxView';
import StrengthParameterSummary from '../IvCalc/Strength/StrengthParameterSummary';
import IvState from '../IvCalc/IvState';
// import { b } from 'vitest/dist/chunks/suite.d.FvehnV49';

const defaultIV = getInitialIvState().pokemonIv.changeLevel(1);

export default function PartyCalcApp() {
  // const { t } = useTranslation();
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
  const currentIndexRef = React.useRef(currentTeamIndex);
  React.useEffect(() => {
    currentIndexRef.current = currentTeamIndex;
  }, [currentTeamIndex]);

  // 現在のパーティを取得
  
  const [params, setParams] = useState<StrengthParameter>(() => loadStrengthParameter());
  const [selectedId, setSelectedId] = useState<number>(() => {
    return -1;
  });
  const [tabValue, setTabValue] = useState(0);
  const [energyDialogOpen, setEnergyDialogOpen] = useState(false);
  const [boxItemDialogOpen, setBoxItemDialogOpen] = useState(false);
  const [teamItemEditIdx, setTeamItemEditIdx] = useState<number | null>(null);
  const deferredTeamIndex = React.useDeferredValue(currentTeamIndex);
  const [strengthTabValue, setStrengthTabValue] = useState(0);
  const [teamItemViewIdx, setTeamItemViewIdx] = useState<number | null>(null);
  const [isEditBoxItem, setIsEditBoxItem] = useState<boolean>(false);
  const [editBoxItem, setEditBoxItem] = useState<PokemonBoxItem | null>(null);


  const box = useMemo(() => {
    const b = new PokemonBox();
    b.load();
    return b;
}, []);

  // 3. データを保存する共通関数
  const saveTeams = (newAllTeams: (string | null)[][]) => {
    setAllTeams(newAllTeams);
    localStorage.setItem('PstPartySelectionGroups', JSON.stringify(newAllTeams));
  };

  // 4. パーティ切り替え
  const handleSwitchTeam = useCallback((idx: number) => {
    setCurrentTeamIndex(idx);
    localStorage.setItem('PstCurrentTeamIndex', idx.toString());

    React.startTransition(() => {
      setStrengthTabValue(0);
      setTeamItemViewIdx(null);
    });
  }, []);

  const handleClearAll = useCallback(() => {
    if (window.confirm(`パーティ ${currentTeamIndex + 1} をリセットしますか？`)) {
      const newAllTeams = [...allTeams];
      newAllTeams[currentTeamIndex] = [null, null, null, null, null];
      saveTeams(newAllTeams);
    }
  }, [allTeams, currentTeamIndex]);

  const handleStrengthTabChange = useCallback(() => {
    setStrengthTabValue(0);
    setTeamItemViewIdx(null);
  }, []); 

  const dispatch = useCallback((action: IvAction) => {
    if (action.type === "changeParameter") {
      const newParam = action.payload.parameter;
      setParams(newParam);
      localStorage.setItem('PstStrenghParam', JSON.stringify(newParam));
    } else if (action.type === "openEnergyDialog") {
      setEnergyDialogOpen(true);
    } else if (action.type === "closeEnergyDialog") {
      setEnergyDialogOpen(false);
    } else if (action.type === "changeLowerTab") {
      setTabValue(1);
    } else if (action.type === "select") {
      const fullSerial = box.getById(action.payload.id)?.serialize() || "";
      if (!fullSerial) return;

      setAllTeams(prevAllTeams => {
        const currentTeamIndex = currentIndexRef.current;
        const newAllTeams = [...prevAllTeams];
        const currentTeam = [...newAllTeams[currentTeamIndex]];
        const emptyIndex = currentTeam.findIndex(s => !s);
        
        if (emptyIndex !== -1) {
          currentTeam[emptyIndex] = fullSerial;
          newAllTeams[currentTeamIndex] = currentTeam;
          localStorage.setItem('PstPartySelectionGroups', JSON.stringify(newAllTeams));
          return newAllTeams;
        }
        return prevAllTeams;
      });
      setSelectedId(action.payload.id);
    } else if (action.type === "edit") {
      setIsEditBoxItem(true);
      setBoxItemDialogOpen(true);
      setSelectedId(action.payload.id);
      setEditBoxItem(box.getById(action.payload.id));
    } else {
      console.warn(`Unknown action type: ${action.type}`);
    }
  }, [box]);

  const defaultResult = new PokemonStrength(defaultIV, params).calculate();
  const teamData = useMemo(() => {
    const teamSerials = allTeams[deferredTeamIndex];

    // --- 1. メンバーの復元（デシリアライズは1回だけ） ---
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

    // --- 2. 下準備：パーティ全体の基本情報の抽出 ---
    const validMembers = members.filter((m): m is Exclude<typeof m, null> => m !== null);
    const totalHbCount = validMembers.filter(m => m.iv.hasHelpingBonusInActiveSubSkills).length;
    
    // チーム内のタイプ重複チェック用
    const teamSpecies: Record<string, Set<string>> = {};
    validMembers.forEach(m => {
      const { type, name } = m.iv.pokemon;
      if (!teamSpecies[type]) teamSpecies[type] = new Set();
      teamSpecies[type].add(name);
    });

    // --- 3. 下準備：スキル計算に必要な「パーティ全体の基礎値」を1回だけ計算 ---
    const strengthPerHelpCalcParams = createStrengthParameter({
      ...params,
      addHelpingBonusEffect: false,
      totalFlags: [true, false, true], // 食材無効
      period: -1
    });

    // 各自の「ヘルプ1回あたりの値」をあらかじめ計算しておく
    const preCalculatedBaseStats = members.map(m => {
      if (!m) return null;
      const pokeStrength = new PokemonStrength(m.iv, strengthPerHelpCalcParams).calculate();
      return {
        berry: pokeStrength.berryTotalStrength,
        ing: pokeStrength.ingredients
      };
    });

    const teamStrengthPerHelpBerryTotal = preCalculatedBaseStats.reduce((acc, val) => acc + (val?.berry || 0), 0);

    // --- 4. 各スロットの個別計算（メインループ） ---
    return members.map((m, idx) => {
      if (!m) return null;
      const { iv, nickname } = m;

      // ヘルプボーナスの適用計算
      const isOwnerHB = iv.hasHelpingBonusInActiveSubSkills;
      const applicableHbCount = isOwnerHB ? Math.max(0, totalHbCount - 1) : totalHbCount;

      // おてつだいブースト等の計算用チーム情報
      const berryBurstTeam = members
        .filter((mm, i) => i !== idx)
        .map(mm => ({
          type: mm !== null ? mm.iv.pokemon.type : defaultIV.pokemon.type,
          level: params.level === 0 ? (mm !== null ? mm.iv.level : defaultIV.level ) : params.level
        }));

      const currentCalcParams = createStrengthParameter({
        ...params,
        addHelpingBonusEffect: false,
        helpBonusCount: Math.min(applicableHbCount, 4) as 0 | 1 | 2 | 3 | 4,
        totalFlags: [true, false, true],
        berryBurstTeam: {
          auto: false,
          members: berryBurstTeam,
          species: Math.max(teamSpecies[iv.pokemon.type]?.size || 1, 1)
        }
      });

      const pokeStrength = new PokemonStrength(iv, currentCalcParams);
      const pokeStrengthCal = pokeStrength.calculate();

      // --- 5. スキル計算（preCalculatedBaseStats を利用して再計算を回避） ---
      let skillStrength = 0;
      let skillIngTotal: Record<string, number> | null = null;

      const skillName = iv.pokemon.skill;
      if (skillName.includes("Helper Boost")) {
        const skillBaseValue = getSkillValue("Helper Boost", pokeStrength.getSkillLevel(), Math.max(teamSpecies[iv.pokemon.type].size, 1));
        const skillCount = pokeStrengthCal.skillCount;
        skillStrength = skillBaseValue * skillCount * teamStrengthPerHelpBerryTotal;
        
        skillIngTotal = {};
        preCalculatedBaseStats.forEach(stat => {
          stat?.ing.forEach(ing => {
            if (ing.name === "unknown") return;
            skillIngTotal![ing.name] = (skillIngTotal![ing.name] || 0) + (ing.count * skillBaseValue * skillCount);
          });
        });
      } else if (skillName.includes("Extra Helpful S")) {
        const ratio = pokeStrengthCal.skillValue / validMembers.length;
        skillStrength = ratio * teamStrengthPerHelpBerryTotal;
        
        skillIngTotal = {};
        preCalculatedBaseStats.forEach(stat => {
          stat?.ing.forEach(ing => {
            if (ing.name === "unknown") return;
            skillIngTotal![ing.name] = (skillIngTotal![ing.name] || 0) + (ing.count * ratio);
          });
        });
      } else if (!["Ingredient Magnet S", "Cooking Power-Up S", "Ingredient Draw S"].some(s => skillName.includes(s))) {
        skillStrength = pokeStrengthCal.skillStrength + pokeStrengthCal.skillStrength2;
      }

      // ボックスとの同期チェック
      const originalBoxItem = box.items.find(item => item.nickname === nickname && item.iv.pokemonName === iv.pokemonName);
      const editFlag = !originalBoxItem || !originalBoxItem.iv.isEqual(iv);
      const isReplayhed = !!originalBoxItem && !originalBoxItem.iv.isEqual(iv);

      return {
        iv,
        nickname: nickname || iv.pokemonName,
        result: pokeStrengthCal,
        skillStrength,
        skillIngTotal,
        param: currentCalcParams,
        editFlag,
        isReplayhed
      };
    });
  }, [allTeams, deferredTeamIndex, params, box]);
  // const teamData = useMemo(() => {
  //   const teamSerials = allTeams[currentTeamIndex];

  //   // 1. 全メンバーを復元（ニックネーム分離）
  //   const members = teamSerials.map(s => {
  //     if (!s) return null;
  //     try {
  //       const [serial, nickname] = s.split('@');
  //       const iv = PokemonIv.deserialize(serial);
  //       return { iv, nickname };
  //     } catch {
  //       return null;
  //     }
  //   });

  //   // 2. パーティ内の合計HB数を算出
  //   const totalHbCount = members.filter(m => m?.iv.hasHelpingBonusInActiveSubSkills).length;
  //   const teamTypeAndLevel = members.map(m => {
  //     if (!m) return defaultIV;
  //     return m.iv;
  //   });

  //   const teamSpecies: Record<PokemonType, Set<string>> = members.reduce((acc, m) => {
  //     if (!m) return acc;
  //     const name = m.iv.pokemon.name;
  //     const type = m.iv.pokemon.type;
  //     if (!acc[type]) acc[type] = new Set<string>();
  //     acc[type].add(name);
  //     return acc;
  //   }, {} as Record<PokemonType, Set<string>>);

  //   const strengthPerHelpCalcParams = createStrengthParameter({
  //     ...params,
  //     addHelpingBonusEffect: false,
  //     totalFlags: [true, false, true], // 食材無効
  //     period: -1
  //   });
  //   const teamStrengthPerHelp = members.reduce((acc, m) => {
  //     if (!m) return acc;
  //     const pokeStrength = new PokemonStrength(m.iv, strengthPerHelpCalcParams).calculate();
  //     acc.push({berry: pokeStrength.berryTotalStrength, ing: pokeStrength.ingredients});
  //     return acc;
  //   }, [] as {berry: number; ing: {name: IngredientName; count: number}[]}[]);

  //   const teamStrengthPerHelpBerryTotal: number = teamStrengthPerHelp.reduce((acc, val) => {
  //     return acc + val.berry;
  //   }, 0);

  //   // const teamStrengthPerHelpIngTotal: Record<IngredientName, number> = teamStrengthPerHelp.reduce((acc, val) => {
  //   //   val.ing.forEach(ing => {
  //   //     if (ing.name === "unknown") return;
  //   //     acc[ing.name] = (acc[ing.name] || 0) + ing.count;
  //   //   });
  //   //   return acc;
  //   // }, {} as Record<IngredientName, number>);

  //   // 3. 各スロットの個別計算（idx を削除して ESLint エラーを回避）
  //   return members.map((m) => {
  //     if (!m) return null;
  //     const { iv, nickname} = m;
      
  //     const isOwnerHB = iv.hasHelpingBonusInActiveSubSkills;
  //     const applicableHbCount = isOwnerHB ? Math.max(0, totalHbCount - 1) : totalHbCount;

  //     const berryBurstTeam = teamTypeAndLevel.filter(mm => m.iv != mm).map(mm => ({
  //       type: mm.pokemon.type,
  //       level: params.level === 0 ? mm.level : params.level
  //     }));

  //     const currentCalcParams = createStrengthParameter({
  //       ...params,
  //       addHelpingBonusEffect: false,
  //       helpBonusCount: Math.min(applicableHbCount, 4) as 0 | 1 | 2 | 3 | 4,
  //       totalFlags: [true, false, true], // 食材無効
  //       berryBurstTeam: {
  //         auto: false,
  //         members: berryBurstTeam,
  //         species: Math.max(teamSpecies[iv.pokemon.type].size, 1)
  //       }
  //     });

  //     const pokeStrength = new PokemonStrength(iv, currentCalcParams)
  //     const pokeStrengthCal = pokeStrength.calculate();
  //     let skillStrength = 0;
  //     let skillIngTotal;
  //     if (iv.pokemon.skill.includes("Ingredient Magnet S") ||
  //         iv.pokemon.skill.includes("Cooking Power-Up S") ||
  //         iv.pokemon.skill.includes("Ingredient Draw S")
  //     ){
  //       skillStrength = 0;
  //       skillIngTotal = null;
  //     } else if (iv.pokemon.skill.includes("Helper Boost")) {
  //       const skillBaseValue = getSkillValue("Helper Boost", pokeStrength.getSkillLevel(), Math.max(teamSpecies[iv.pokemon.type].size, 1));
  //       skillStrength = skillBaseValue * pokeStrengthCal.skillCount * teamStrengthPerHelpBerryTotal;
  //       skillIngTotal = teamStrengthPerHelp.reduce((acc, val) => {
  //         val.ing.forEach(ing => {
  //           if (ing.name === "unknown") return;
  //           acc[ing.name] = (acc[ing.name] || 0) + (ing.count * skillBaseValue * pokeStrengthCal.skillCount);
  //         });
  //         return acc;
  //       }, {} as Record<IngredientName, number>);

  //       // console.log("Helper Boost skillStrength:", skillStrength, skillBaseValue, pokeStrengthCal.skillCount, teamStrengthPerHelpBerryTotal, skillIngTotal);
  //     } else if (iv.pokemon.skill.includes("Extra Helpful S")) {
  //       skillStrength = pokeStrengthCal.skillValue * teamStrengthPerHelpBerryTotal / teamStrengthPerHelp.length;
  //       skillIngTotal = teamStrengthPerHelp.reduce((acc, val) => {
  //         val.ing.forEach(ing => {
  //           if (ing.name === "unknown") return;
  //           acc[ing.name] = (acc[ing.name] || 0) + (ing.count * pokeStrengthCal.skillValue / teamStrengthPerHelp.length);
  //         });
  //         return acc;
  //       }, {} as Record<IngredientName, number>);

  //       // console.log("Extra Helpful S skillStrength:", skillStrength, pokeStrengthCal.skillValue, teamStrengthPerHelpBerryTotal, teamStrengthPerHelp.length, skillIngTotal);
  //     } else {
  //       skillStrength = pokeStrengthCal.skillStrength + pokeStrengthCal.skillStrength2;
  //       skillIngTotal = null;
  //     }

  //     let editFlag = true;
  //     let isReplayhed = false;
  //     box.items.forEach(item => {
  //       if (item.nickname === nickname && item.iv.isEqual(iv)) {
  //         editFlag = false;
  //       }
  //       if (item.nickname === nickname && item.iv.pokemonName === iv.pokemonName && !item.iv.isEqual(iv)) {
  //         isReplayhed = true;
  //       }
  //     });
      
  //     try {
  //       return { 
  //         iv, 
  //         nickname: nickname || iv.pokemonName,
  //         result: pokeStrengthCal,
  //         skillStrength: skillStrength,
  //         skillIngTotal: skillIngTotal,
  //         param: currentCalcParams,
  //         editFlag: editFlag,
  //         isReplayhed: isReplayhed
  //       };
  //     } catch {
  //       return null;
  //     }
  //   });
  // }, [allTeams, currentTeamIndex, params, box]);

  // handleSelectFromBox などの更新

  const handleRemoveMember = useCallback((idx: number) => {
    const newAllTeams = [...allTeams];
    const currentTeam = [...newAllTeams[currentTeamIndex]];
    currentTeam[idx] = null;
    newAllTeams[currentTeamIndex] = currentTeam;
    saveTeams(newAllTeams);
    setStrengthTabValue(0);
  }, [allTeams, currentTeamIndex]);

  const handleEditTeamMember = useCallback((idx: number) => {
    setTeamItemEditIdx(idx);

    const editTeamMemberBoxItem = (currentTeamIndex !== null &&  teamData[idx] !== null) ? new PokemonBoxItem(
      teamData[idx].iv,
      teamData[idx].nickname,
      -1
    ) : null;

    setEditBoxItem(editTeamMemberBoxItem);
    setIsEditBoxItem(true);
    setBoxItemDialogOpen(true);
  }, [teamData, currentTeamIndex]);

  const handleSelectMemberView = useCallback((idx: number) => {
    setTeamItemViewIdx(idx);
    setStrengthTabValue(1);
  }, []);

  const onBoxItemDialogClose = useCallback(() => {
    setBoxItemDialogOpen(false);
  }, []);

  const onBoxItemDialogChange = useCallback((value: PokemonBoxItem) => {
    if (!value) return;
    const currentTeamIndex = currentIndexRef.current;
    if (value.id === -1 && teamItemEditIdx !== null) {
      const fullSerial = `${value.iv.serialize()}@${value.nickname || ""}`;
      allTeams[currentTeamIndex][teamItemEditIdx] = fullSerial;
      const newAllTeams = [...allTeams];
      saveTeams(newAllTeams);
    } else {
      // 既存のボックスアイテムを編集した場合は、IDで探して更新
      const originalBoxItem = box.getById(value.id);
      if (!originalBoxItem) return;
      box.set(value.id, value.iv, value.nickname);
      box.save();
    }
    setTeamItemEditIdx(null);
  }, [allTeams, teamItemEditIdx, box]);

  const handleReplayMember = useCallback((idx: number) => {
    if (teamData[idx] === null) return;

    const originalBoxItem = box.items.find(item => 
      item.nickname === teamData[idx]!.nickname && 
      item.iv.pokemonName === teamData[idx]!.iv.pokemonName
    );
    if (!originalBoxItem) return;
    const fullSerial = originalBoxItem.serialize();
    allTeams[currentTeamIndex][idx] = `${fullSerial}`;
    const newAllTeams = [...allTeams];
    saveTeams(newAllTeams);
  }, [allTeams, teamData, currentTeamIndex, box]);

  const viewMemberIV = (teamItemViewIdx !== null && teamData[teamItemViewIdx] !== null) ? teamData[teamItemViewIdx].iv : defaultIV;
  const viewMemberParam = (teamItemViewIdx !== null && teamData[teamItemViewIdx] !== null) ? teamData[teamItemViewIdx].param : params;
  const pseudoState = {
    parameter: params,
  } as unknown as IvState;
  
  return (
    <div>
    <Box sx={{ p: 2, pb: 1 }}>
      {strengthTabValue === 0 ?(
        <TeamSummary teamData={teamData} />
        ) : (
          <Paper sx={{ p: 2, bgcolor: '#fdfdfd', borderRadius: 2 }}>
            <StrengthBerryIngSkillView pokemonIv={viewMemberIV} settings={viewMemberParam} energyDialogOpen={energyDialogOpen} dispatch={dispatch} />
          </Paper>
        )
      }
      <Box sx={{zIndex: 10, position: 'sticky', top: 0, bgcolor: '#fdfdfd', pt: 1, pb: 1, mt: 1, borderBottom: '1px solid #ddd'}}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1}}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>パーティ編成 {currentTeamIndex + 1}
            <IconButton 
              size="small" 
              onClick={handleStrengthTabChange} 
              sx={{ position: 'relative', top: -2.5, left: 5, p: 0.2,  }}
            >
          <InfoOutlinedIcon sx={{ fontSize: 24, color: (strengthTabValue === 0 ? '#29ce10ff' : 'inherit')}} />
        </IconButton>
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          {teamData.map((data, idx) => (
            <Box key={`slot-${idx}-${data?.iv || 'empty'}`} sx={{ width: '20%', minWidth: 0 }}>
              <PartyMemberSlot member={data} onRemove={() => handleRemoveMember(idx)} onEdit={() => handleEditTeamMember(idx)} onView={() => handleSelectMemberView(idx)} onReplay={() => handleReplayMember(idx)} infoFlag={idx === teamItemViewIdx} />
            </Box>
          ))}
        </Box>

        <Box sx={{ px: 1}}>
          <StrengthParameterSummary state={pseudoState} dispatch={dispatch} />
        </Box>
      </Box>
      
      

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 4, mb: 2 }}>
        <Tabs value={tabValue} onChange={(_e, v) => setTabValue(v)} variant="fullWidth">
          <Tab label="ポケモン選択" />
          <Tab label="計算条件設定" />
        </Tabs>
      </Box>
      </Box>

      <div style={{display: tabValue === 0 ? 'block' : 'none'}}>
        <BoxView items={box.items} iv={defaultIV} selectedId={selectedId} dispatch={dispatch} parameter={params} />
      </div>
      <div style={{ contentVisibility: 'auto' , display: tabValue === 1 ? 'block' : 'none' }}>
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
      </div>

      <BoxItemDialog
        // key={"dlg" + (new Date()).getTime().toString()}
        open={boxItemDialogOpen} boxItem={editBoxItem}
        isEdit={isEditBoxItem}
        onClose={onBoxItemDialogClose} onChange={onBoxItemDialogChange}
      />
    </div>
  );
}